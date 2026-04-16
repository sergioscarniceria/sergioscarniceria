/**
 * Servicio de lectura de báscula Torrey PCR-40
 * Usa Web Serial API para comunicación directa desde Chrome en Windows
 * Conexión: RS232 vía adaptador USB-Serial (PL2303, CH340, FT232, etc.)
 *
 * Protocolo Torrey PCR-40:
 * - Baudrate: 9600, 8N1
 * - Envía peso en ASCII al recibir comando "P" o en modo continuo
 * - Formato respuesta: cadena ASCII con peso en kg, ej: "+  0.450 kg\r\n"
 *
 * NOTA: El formato exacto puede variar. Este servicio intenta parsear
 * múltiples formatos comunes de Torrey. Cuando llegue la báscula real,
 * se puede ajustar el parser conectándola y leyendo los datos raw.
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

      // Intentar reconectar a puerto previamente autorizado
      const ports = await navigator.serial!.getPorts();
      let port = ports.length > 0 ? ports[0] : null;

      if (!port) {
        // Solicitar puerto al usuario
        port = await navigator.serial!.requestPort();
      }

      // Configuración Torrey PCR-40: 9600 baud, 8N1
      await port.open({
        baudRate: 9600,
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
   * Parser de datos de la báscula Torrey.
   * Intenta múltiples formatos porque el protocolo exacto puede variar:
   *
   * Formato 1 (Torrey estándar): "ST,GS, 0.450kg"
   * Formato 2 (con signo):       "+  0.450 kg"
   * Formato 3 (solo número):     "0.450"
   * Formato 4 (con estado):      "ST,GS,+  0.450kg"
   * Formato 5 (con ceros):       "00.450"
   *
   * ST = Stable, US = Unstable, OL = Overload
   * GS = Gross, NT = Net, TF = Tare
   */
  private parseLine(line: string): void {
    let weight = 0;
    let stable = true;
    let unit = "kg";

    // Detectar estabilidad
    if (line.includes("US") || line.includes("MO")) {
      stable = false;
    }
    if (line.includes("ST")) {
      stable = true;
    }

    // Detectar sobrecarga
    if (line.includes("OL") || line.includes("OVER")) {
      this.notifyListeners(-1, unit, false);
      return;
    }

    // Extraer número: buscar patrón numérico con punto decimal
    const numMatch = line.match(/[+-]?\s*(\d+\.?\d*)/);
    if (numMatch) {
      weight = parseFloat(numMatch[1]);

      // Verificar signo negativo
      if (line.includes("-")) {
        weight = -weight;
      }
    }

    // Detectar unidad
    if (line.toLowerCase().includes("lb")) {
      unit = "lb";
    } else if (line.toLowerCase().includes("oz")) {
      unit = "oz";
    } else {
      unit = "kg";
    }

    // Solo notificar si el peso cambió o es relevante
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
