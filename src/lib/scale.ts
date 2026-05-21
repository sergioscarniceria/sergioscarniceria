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

// URL del relay local (PowerShell que mantiene COM7 abierto y expone HTTP)
// Solo se usa si /salud responde OK. Si no, fallback automático a WebSerial.
const RELAY_URL = "http://localhost:8765";
const RELAY_DETECT_TIMEOUT_MS = 500;
const RELAY_POLL_INTERVAL_MS = 250;
const RELAY_FETCH_TIMEOUT_MS = 800;
const RELAY_STALE_THRESHOLD_MS = 2000;

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
  private pollInterval: any = null;
  private listeners: WeightCallback[] = [];
  private _lastWeight: number = 0;
  private _lastStable: boolean = false;
  private _rawBuffer: string = "";
  private _writing: boolean = false;

  status: ScaleStatus = "disconnected";
  error: string = "";

  // Relay HTTP local (PC con 2 monitores) — null = no inicializado, true = activo, false = WebSerial directo
  private _useRelay: boolean | null = null;
  private _relayInterval: any = null;
  private _relayLastFetchTs: number = 0;

  get usingRelay(): boolean {
    return this._useRelay === true;
  }

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

      // ─── Detección automática de relay HTTP local ───
      // Si hay un relay vivo en localhost:8765, lo usamos (modo 2 monitores).
      // Si no, caemos al flujo WebSerial original (PC de 1 monitor).
      const relayOk = await this._detectRelay();
      if (relayOk) {
        this._useRelay = true;
        this.status = "ready";
        this.error = "";
        this._startRelayPolling();
        console.log("Báscula vía relay HTTP en", RELAY_URL);
        return true;
      }
      this._useRelay = false;

      // Intentar reconectar a puerto previamente autorizado
      const ports = await navigator.serial!.getPorts();
      let port = ports.length > 0 ? ports[0] : null;

      if (!port) {
        // Mostrar TODOS los dispositivos serial (no filtrar por VID/PID
        // porque puede variar según el driver de Windows)
        port = await navigator.serial!.requestPort();
      }

      // Si el puerto ya está abierto, cerrarlo primero
      try {
        if (port.readable || port.writable) {
          await port.close();
        }
      } catch {
        // ignore - puede que no esté abierto
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

      // Enviar "P" cada 800ms para pedir peso (la Torrey PCR solo responde bajo demanda)
      this.pollInterval = setInterval(() => {
        this.sendCommand("P").catch(() => {});
      }, 800);

      // Mandar el primer "P" inmediatamente
      this.sendCommand("P").catch(() => {});

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

    // Limpiar polling del relay (si estaba activo)
    if (this._relayInterval) {
      clearInterval(this._relayInterval);
      this._relayInterval = null;
    }
    this._useRelay = null;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

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
  // Lock para evitar race condition cuando el interval y una llamada manual coinciden
  async sendCommand(cmd: string): Promise<void> {
    if (!this.port || !this.port.writable || this._writing) return;

    this._writing = true;
    try {
      const writer = this.port.writable.getWriter();
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(cmd));
      writer.releaseLock();
    } catch (err: any) {
      console.warn("Error enviando comando a báscula:", err.message);
    } finally {
      this._writing = false;
    }
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

  // ─── Modo Relay HTTP (PC con 2 monitores) ───

  private async _detectRelay(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), RELAY_DETECT_TIMEOUT_MS);
      const resp = await fetch(`${RELAY_URL}/salud`, {
        method: "GET",
        signal: ctrl.signal,
        mode: "cors",
      });
      clearTimeout(t);
      if (!resp.ok) return false;
      const data = await resp.json();
      return data && data.ok === true;
    } catch {
      return false;
    }
  }

  private _startRelayPolling(): void {
    this.status = "reading";
    if (this._relayInterval) clearInterval(this._relayInterval);
    this._relayInterval = setInterval(() => {
      this._fetchRelayWeight();
    }, RELAY_POLL_INTERVAL_MS);
    // Primer fetch inmediato
    this._fetchRelayWeight();
  }

  private async _fetchRelayWeight(): Promise<void> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), RELAY_FETCH_TIMEOUT_MS);
      const resp = await fetch(`${RELAY_URL}/peso`, {
        method: "GET",
        signal: ctrl.signal,
        mode: "cors",
      });
      clearTimeout(t);
      this._relayLastFetchTs = Date.now();

      const data = await resp.json();
      if (!data || data.ok === false) {
        // Báscula desconectada del relay → marcar inestable pero conservar último peso conocido
        if (this._lastStable) {
          this._lastStable = false;
          this.notifyListeners(this._lastWeight, "kg", false);
        }
        return;
      }

      const kg = Number(data.kg || 0);
      const staleMs = Number(data.stale_ms || 0);
      const stable = staleMs <= RELAY_STALE_THRESHOLD_MS;

      if (kg !== this._lastWeight || stable !== this._lastStable) {
        this.notifyListeners(kg, "kg", stable);
      }
    } catch {
      // Error de red. NO hacer fallback a WebSerial (re-introduciría conflicto).
      // Solo marcar inestable.
      if (this._lastStable) {
        this._lastStable = false;
        this.notifyListeners(this._lastWeight, "kg", false);
      }
    }
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
