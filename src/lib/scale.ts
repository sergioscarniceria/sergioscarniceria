/**
 * Servicio de lectura de báscula Torrey PCR-40
 * Usa Web Serial API para comunicación directa desde Chrome en Windows
 *
 * Hardware confirmado (2026-04-22):
 * - Chip: STMicroelectronics STM32 Virtual COM Port
 * - VID/PID USB: 0x0483 / 0x5740
 * - Baudrate: 115200, 8N1, sin flow control
 * - Comando para pedir peso: "P" (0x50)
 * - Terminador de respuesta: CR (0x0D)
 * - Formato respuesta: "  0.278 kg\r" (2 espacios + número 3 decimales + espacio + kg + CR)
 * - Posibles prefijos: "SOBRE PESO", "NEG", "NETO"
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Navigator {
    serial?: any;
  }
}

type ScaleStatus = "disconnected" | "connecting" | "ready" | "reading" | "error";

type WeightCallback = (weight: number, unit: string, stable: boolean) => void;

class TorreyScale {
  private port: any = null;
  private reader: any = null;
  private readLoop: boolean = false;
  private listeners: WeightCallback[] = [];
  private _lastWeight: number = 0;
  private _lastStable: boolean = false;
  private _rawBuffer: string = "";

  status: ScaleStatus = "disconnected";
  error: string = "";

  get isConnected(): boolean {
    return this.status === "ready" || this.status === "reading";
  }

  get isSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  get lastWeight(): number {
    return this._lastWeight;
  }

  get lastStable(): boolean {
    return this._lastStable;
  }

  // Suscribirse a cambios de peso
  onWeight(callback: WeightCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(weight: number, unit: string, stable: boolean) {
    this._lastWeight = weight;
    this._lastStable = stable;
    for (const cb of this.listeners) {
      try {
        cb(weight, unit, stable);
      } catch {
        // ignore listener errors
      }
    }
  }

  async connect(): Promise<boolean> {
    if (!this.isSupported) {
      this.error = "Web Serial no soportado en este navegador";
      this.status = "error";
      return false;
    }

    try {
      this.status = "connecting";

      // Filtro por VID/PID confirmado de la Torrey PCR (STM32 Virtual COM)
      const TORREY_FILTERS = [{ usbVendorId: 0x0483, usbProductId: 0x5740 }];

      // Intentar reconectar a puerto previamente autorizado
      const ports = await navigator.serial!.getPorts();
      let port = ports.find((p: any) => {
        const info = p.getInfo?.() || {};
        return info.usbVendorId === 0x0483 && info.usbProductId === 0x5740;
      }) || null;

      if (!port) {
        // Solicitar puerto al usuario (filtrado a solo la Torrey)
        port = await navigator.serial!.requestPort({ filters: TORREY_FILTERS });
      }

      // Configuración Torrey PCR-40: 115200 baud, 8N1 (confirmado con hardware real)
      await port.open({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      });

      this.port = port;
      this.status = "ready";
      this.error = "";

      // Iniciar lectura continua
      this.startReading();

      console.log("Báscula conectada");
      return true;
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        this.status = "disconnected";
        return false;
      }
      this.error = err.message || "Error al conectar báscula";
      this.status = "error";
      console.error("Error conectando báscula:", err);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.readLoop = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // ignore
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // ignore
      }
      this.port = null;
    }

    this.status = "disconnected";
    this._lastWeight = 0;
    this._lastStable = false;
  }

  // Enviar comando a la báscula (ej: "P" para solicitar peso)
  async sendCommand(cmd: string): Promise<void> {
    if (!this.port || !this.port.writable) return;

    const writer = this.port.writable.getWriter();
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(cmd));
    writer.releaseLock();
  }

  // Solicitar lectura de peso
  async requestWeight(): Promise<void> {
    await this.sendCommand("P");
  }

  private async startReading(): Promise<void> {
    if (!this.port || !this.port.readable) return;

    this.readLoop = true;
    this.status = "reading";
    const decoder = new TextDecoder();

    while (this.readLoop && this.port?.readable) {
      try {
        this.reader = this.port.readable.getReader();

        while (this.readLoop) {
          const { value, done } = await this.reader.read();
          if (done) break;

          const text = decoder.decode(value);
          this._rawBuffer += text;

          // Procesar líneas completas
          const lines = this._rawBuffer.split(/[\r\n]+/);
          this._rawBuffer = lines.pop() || ""; // Guardar última línea incompleta

          for (const line of lines) {
            if (line.trim()) {
              this.parseLine(line.trim());
            }
          }
        }
      } catch (err: any) {
        if (this.readLoop) {
          console.error("Error leyendo báscula:", err);
        }
      } finally {
        if (this.reader) {
          try {
            this.reader.releaseLock();
          } catch {
            // ignore
          }
          this.reader = null;
        }
      }
    }

    if (this.status === "reading") {
      this.status = "ready";
    }
  }

  /**
   * Parser confirmado con hardware real (2026-04-22).
   * Formato: "  0.278 kg\r"
   * Posibles: "SOBRE PESO", "NEG  0.120 kg", "NETO  0.300 kg"
   */
  private parseLine(line: string): void {
    const unit = "kg";

    // Sobrecarga
    if (line.includes("SOBRE PESO")) {
      this.notifyListeners(-1, unit, false);
      return;
    }

    // Peso negativo (tara y quitas algo)
    const negativo = line.includes("NEG");

    // NETO = modo tara activo (peso estable)
    const neto = line.includes("NETO");

    // Extraer número: buscar patrón "X.XXX kg"
    const match = line.match(/([\d.]+)\s*kg/i);
    if (!match) {
      // Línea no reconocida, ignorar
      return;
    }

    let weight = parseFloat(match[1]);
    if (negativo) weight = -weight;

    const stable = true; // La Torrey PCR responde solo cuando tiene lectura estable

    // Solo notificar si el peso cambió
    if (weight !== this._lastWeight || stable !== this._lastStable) {
      this.notifyListeners(weight, unit, stable);
    }
  }

  /**
   * Obtiene los datos raw del puerto serial para debugging.
   * Útil para ajustar el parser cuando conectemos la báscula real.
   */
  getRawBuffer(): string {
    return this._rawBuffer;
  }
}

// ============ Singleton ============
let scaleInstance: TorreyScale | null = null;

export function getScale(): TorreyScale {
  if (!scaleInstance) {
    scaleInstance = new TorreyScale();
  }
  return scaleInstance;
}

// ============ React hook helper ============

/**
 * Hook helper para usar en componentes React.
 * Uso:
 *   const { weight, stable, connected } = useScaleState();
 *
 * Este es un helper que retorna funciones para crear el estado.
 * El hook real se implementa en el componente porque necesita useState/useEffect.
 */
export function createScaleHook() {
  return {
    scale: getScale(),
    subscribe: (callback: WeightCallback) => getScale().onWeight(callback),
    connect: () => getScale().connect(),
    disconnect: () => getScale().disconnect(),
    requestWeight: () => getScale().requestWeight(),
  };
}
