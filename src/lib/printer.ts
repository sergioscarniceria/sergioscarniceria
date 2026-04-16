/**
 * Servicio de impresión ESC/POS para Epson T20iv-l
 * Usa WebUSB API para comunicación directa desde Chrome en Windows
 * Sin necesidad de instalar software adicional
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Navigator {
    usb?: any;
  }
}
type USBDevice = any;

// ============ ESC/POS Commands ============
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const CMD = {
  INIT: [ESC, 0x40], // Initialize printer
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  DOUBLE_SIZE: [GS, 0x21, 0x11], // Double width + double height
  NORMAL_SIZE: [GS, 0x21, 0x00],
  WIDE_SIZE: [GS, 0x21, 0x10], // Double width only
  TALL_SIZE: [GS, 0x21, 0x01], // Double height only
  CUT_PAPER: [GS, 0x56, 0x42, 0x03], // Partial cut with 3-line feed
  OPEN_DRAWER: [ESC, 0x70, 0x00, 0x19, 0x78], // Pin 2, 25ms on, 120ms off
  FEED_LINES: (n: number) => Array(n).fill(LF),
  UNDERLINE_ON: [ESC, 0x2d, 0x01],
  UNDERLINE_OFF: [ESC, 0x2d, 0x00],
};

// Epson USB Vendor ID
const EPSON_VENDOR_ID = 0x04b8;

// ============ Encoder helpers ============
const encoder = new TextEncoder();

function textToBytes(text: string): number[] {
  return Array.from(encoder.encode(text));
}

function line(text: string): number[] {
  return [...textToBytes(text), LF];
}

function separatorLine(char = "-", width = 48): number[] {
  return line(char.repeat(width));
}

function twoColumns(left: string, right: string, width = 48): number[] {
  const space = width - left.length - right.length;
  if (space < 1) return line(left.slice(0, width - right.length - 1) + " " + right);
  return line(left + " ".repeat(space) + right);
}

function padCenter(text: string, width = 48): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(pad) + text;
}

// ============ QR Code ESC/POS ============
function qrCode(data: string, size = 6): number[] {
  const bytes: number[] = [];
  const dataBytes = textToBytes(data);
  const len = dataBytes.length + 3;
  const pL = len % 256;
  const pH = Math.floor(len / 256);

  // Model: QR Model 2
  bytes.push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
  // Size (1-16)
  bytes.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);
  // Error correction: M (15%)
  bytes.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
  // Store data
  bytes.push(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...dataBytes);
  // Print stored QR
  bytes.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);

  return bytes;
}

// ============ WebUSB Printer Class ============

type PrinterStatus = "disconnected" | "connecting" | "ready" | "printing" | "error";

class ThermalPrinter {
  private device: USBDevice | null = null;
  private endpointOut: number = 0;
  status: PrinterStatus = "disconnected";
  error: string = "";

  get isConnected(): boolean {
    return this.status === "ready" || this.status === "printing";
  }

  get isSupported(): boolean {
    return typeof navigator !== "undefined" && "usb" in navigator;
  }

  async connect(): Promise<boolean> {
    if (!this.isSupported) {
      this.error = "WebUSB no soportado en este navegador";
      this.status = "error";
      return false;
    }

    try {
      this.status = "connecting";

      // Try to reconnect to previously paired device
      const devices = await navigator.usb.getDevices();
      let device = devices.find((d: any) => d.vendorId === EPSON_VENDOR_ID);

      if (!device) {
        // Request new device
        device = await navigator.usb.requestDevice({
          filters: [{ vendorId: EPSON_VENDOR_ID }],
        });
      }

      await device.open();

      // Find the right interface and endpoint
      const iface = device.configuration?.interfaces.find((i: any) =>
        i.alternate.endpoints.some((e: any) => e.direction === "out")
      );

      if (!iface) {
        throw new Error("No se encontró interfaz de impresión");
      }

      await device.claimInterface(iface.interfaceNumber);

      const endpoint = iface.alternate.endpoints.find((e: any) => e.direction === "out");
      if (!endpoint) {
        throw new Error("No se encontró endpoint de salida");
      }

      this.device = device;
      this.endpointOut = endpoint.endpointNumber;
      this.status = "ready";
      this.error = "";

      console.log("Impresora conectada:", device.productName);
      return true;
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        // User cancelled device picker
        this.status = "disconnected";
        return false;
      }
      this.error = err.message || "Error al conectar";
      this.status = "error";
      console.error("Error conectando impresora:", err);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.close();
      } catch {
        // ignore
      }
      this.device = null;
    }
    this.status = "disconnected";
  }

  async sendBytes(data: number[]): Promise<boolean> {
    if (!this.device || this.status === "disconnected") {
      this.error = "Impresora no conectada";
      return false;
    }

    try {
      this.status = "printing";
      const chunk = 4096;
      for (let i = 0; i < data.length; i += chunk) {
        const slice = new Uint8Array(data.slice(i, i + chunk));
        await this.device.transferOut(this.endpointOut, slice);
      }
      this.status = "ready";
      return true;
    } catch (err: any) {
      this.error = err.message || "Error al imprimir";
      this.status = "error";
      console.error("Error imprimiendo:", err);
      return false;
    }
  }

  async openDrawer(): Promise<boolean> {
    return this.sendBytes(CMD.OPEN_DRAWER);
  }
}

// ============ Singleton instance ============
let printerInstance: ThermalPrinter | null = null;

export function getPrinter(): ThermalPrinter {
  if (!printerInstance) {
    printerInstance = new ThermalPrinter();
  }
  return printerInstance;
}

// ============ Ticket builders ============

export type TicketItem = {
  product: string;
  kilos?: number | null;
  price?: number | null;
  quantity?: number | null;
  sale_type?: string | null;
  is_fixed_price_piece?: boolean | null;
  prepared_kilos?: number | null;
  total?: number;
};

export type TicketData = {
  folio: string;
  customerName?: string | null;
  attendant?: string | null;
  cashier?: string | null;
  items: TicketItem[];
  subtotal: number;
  discount?: number;
  total: number;
  paymentMethod?: string | null;
  change?: number;
  qrData?: string;
  notes?: string | null;
  type?: "venta" | "pedido" | "cobro";
};

function money(n: number): string {
  return n.toFixed(2);
}

function itemTotal(item: TicketItem): number {
  if (item.total !== undefined) return item.total;
  if (item.sale_type === "pieza" && item.is_fixed_price_piece) {
    return (Number(item.quantity) || 0) * (Number(item.price) || 0);
  }
  const kg = Number(item.prepared_kilos || item.kilos || 0);
  return kg * (Number(item.price) || 0);
}

export function buildTicketBytes(ticket: TicketData): number[] {
  const b: number[] = [];
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  // Initialize
  b.push(...CMD.INIT);

  // Header
  b.push(...CMD.ALIGN_CENTER);
  b.push(...CMD.DOUBLE_SIZE);
  b.push(...line("SERGIO'S"));
  b.push(...CMD.NORMAL_SIZE);
  b.push(...CMD.BOLD_ON);
  b.push(...line("CARNICERIA"));
  b.push(...CMD.BOLD_OFF);
  b.push(...line(""));

  // Folio + fecha
  b.push(...CMD.ALIGN_LEFT);
  b.push(...separatorLine("="));
  b.push(...CMD.BOLD_ON);
  b.push(...twoColumns("TICKET:", ticket.folio));
  b.push(...CMD.BOLD_OFF);
  b.push(...twoColumns("Fecha:", `${dateStr} ${timeStr}`));

  if (ticket.customerName && ticket.customerName !== "PUBLICO GENERAL") {
    b.push(...twoColumns("Cliente:", ticket.customerName));
  }
  if (ticket.attendant) {
    b.push(...twoColumns("Atendio:", ticket.attendant));
  }
  if (ticket.cashier) {
    b.push(...twoColumns("Cajera:", ticket.cashier));
  }

  b.push(...separatorLine("="));
  b.push(...line(""));

  // Items header
  b.push(...CMD.BOLD_ON);
  b.push(...twoColumns("PRODUCTO", "IMPORTE"));
  b.push(...CMD.BOLD_OFF);
  b.push(...separatorLine("-"));

  // Items
  for (const item of ticket.items) {
    const total = itemTotal(item);
    b.push(...line(item.product));

    if (item.sale_type === "pieza" && item.is_fixed_price_piece) {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      b.push(...twoColumns(`  ${qty} pza x $${money(price)}`, `$${money(total)}`));
    } else {
      const kg = Number(item.prepared_kilos || item.kilos || 0);
      const price = Number(item.price) || 0;
      b.push(...twoColumns(`  ${kg.toFixed(3)}kg x $${money(price)}`, `$${money(total)}`));
    }
  }

  b.push(...separatorLine("-"));

  // Totals
  if (ticket.discount && ticket.discount > 0) {
    b.push(...twoColumns("SUBTOTAL:", `$${money(ticket.subtotal)}`));
    b.push(...twoColumns("DESCUENTO:", `-$${money(ticket.discount)}`));
  }

  b.push(...CMD.BOLD_ON);
  b.push(...CMD.TALL_SIZE);
  b.push(...twoColumns("TOTAL:", `$${money(ticket.total)}`));
  b.push(...CMD.NORMAL_SIZE);
  b.push(...CMD.BOLD_OFF);

  if (ticket.paymentMethod) {
    const methods: Record<string, string> = {
      efectivo: "Efectivo",
      tarjeta: "Tarjeta",
      transferencia: "Transferencia",
      credito: "Credito",
    };
    b.push(...twoColumns("Pago:", methods[ticket.paymentMethod] || ticket.paymentMethod));
  }

  if (ticket.change && ticket.change > 0) {
    b.push(...twoColumns("Cambio:", `$${money(ticket.change)}`));
  }

  b.push(...line(""));

  // QR Code
  if (ticket.qrData) {
    b.push(...CMD.ALIGN_CENTER);
    b.push(...qrCode(ticket.qrData, 5));
    b.push(...line(""));
    b.push(...CMD.ALIGN_LEFT);
  }

  // Footer
  b.push(...separatorLine("-"));
  b.push(...CMD.ALIGN_CENTER);
  b.push(...line("sergioscarniceria.com"));
  b.push(...line("Gracias por su compra!"));
  b.push(...CMD.ALIGN_LEFT);

  if (ticket.notes) {
    b.push(...line(""));
    b.push(...line(`Nota: ${ticket.notes}`));
  }

  // Feed + Cut
  b.push(...CMD.FEED_LINES(4));
  b.push(...CMD.CUT_PAPER);

  return b;
}

// ============ Corte de caja ticket ============

export type CashCutData = {
  type: "parcial" | "cierre";
  cashier?: string;
  date: string;
  time: string;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalCxC: number;
  totalExpenses: number;
  expectedCash: number;
  countedCash?: number;
  difference?: number;
  ticketCount: number;
};

export function buildCashCutBytes(data: CashCutData): number[] {
  const b: number[] = [];

  b.push(...CMD.INIT);

  // Header
  b.push(...CMD.ALIGN_CENTER);
  b.push(...CMD.DOUBLE_SIZE);
  b.push(...line("SERGIO'S"));
  b.push(...CMD.NORMAL_SIZE);
  b.push(...CMD.BOLD_ON);
  b.push(...line(data.type === "cierre" ? "CORTE DE CAJA" : "CORTE PARCIAL"));
  b.push(...CMD.BOLD_OFF);
  b.push(...line(""));

  b.push(...CMD.ALIGN_LEFT);
  b.push(...separatorLine("="));
  b.push(...twoColumns("Fecha:", data.date));
  b.push(...twoColumns("Hora:", data.time));
  if (data.cashier) {
    b.push(...twoColumns("Cajera:", data.cashier));
  }
  b.push(...separatorLine("="));

  // Ventas
  b.push(...CMD.BOLD_ON);
  b.push(...line("RESUMEN DE VENTAS"));
  b.push(...CMD.BOLD_OFF);
  b.push(...separatorLine("-"));
  b.push(...twoColumns("Tickets:", String(data.ticketCount)));
  b.push(...twoColumns("Total ventas:", `$${money(data.totalSales)}`));
  b.push(...line(""));

  // Desglose
  b.push(...CMD.BOLD_ON);
  b.push(...line("DESGLOSE POR METODO"));
  b.push(...CMD.BOLD_OFF);
  b.push(...separatorLine("-"));
  b.push(...twoColumns("Efectivo:", `$${money(data.totalCash)}`));
  b.push(...twoColumns("Tarjeta:", `$${money(data.totalCard)}`));
  b.push(...twoColumns("Transferencia:", `$${money(data.totalTransfer)}`));
  b.push(...twoColumns("Credito (CxC):", `$${money(data.totalCxC)}`));
  b.push(...separatorLine("-"));
  b.push(...twoColumns("Gastos/Salidas:", `-$${money(data.totalExpenses)}`));
  b.push(...line(""));

  // Caja
  b.push(...CMD.BOLD_ON);
  b.push(...line("CAJA"));
  b.push(...CMD.BOLD_OFF);
  b.push(...separatorLine("-"));
  b.push(...twoColumns("Efectivo esperado:", `$${money(data.expectedCash)}`));

  if (data.countedCash !== undefined) {
    b.push(...twoColumns("Efectivo contado:", `$${money(data.countedCash)}`));
    const diff = data.difference ?? (data.countedCash - data.expectedCash);
    const sign = diff >= 0 ? "+" : "";
    b.push(...CMD.BOLD_ON);
    b.push(...twoColumns("Diferencia:", `${sign}$${money(diff)}`));
    b.push(...CMD.BOLD_OFF);
  }

  b.push(...line(""));
  b.push(...separatorLine("="));
  b.push(...CMD.ALIGN_CENTER);
  b.push(...line(data.type === "cierre" ? "CAJA CERRADA" : "CORTE PARCIAL"));
  b.push(...CMD.ALIGN_LEFT);

  b.push(...CMD.FEED_LINES(4));
  b.push(...CMD.CUT_PAPER);

  return b;
}

// ============ Print helpers (high-level) ============

export async function printTicket(ticket: TicketData): Promise<boolean> {
  const printer = getPrinter();

  if (!printer.isConnected) {
    const connected = await printer.connect();
    if (!connected) return false;
  }

  const bytes = buildTicketBytes(ticket);
  return printer.sendBytes(bytes);
}

export async function printCashCut(data: CashCutData): Promise<boolean> {
  const printer = getPrinter();

  if (!printer.isConnected) {
    const connected = await printer.connect();
    if (!connected) return false;
  }

  const bytes = buildCashCutBytes(data);
  return printer.sendBytes(bytes);
}

export async function openCashDrawer(): Promise<boolean> {
  const printer = getPrinter();

  if (!printer.isConnected) {
    const connected = await printer.connect();
    if (!connected) return false;
  }

  return printer.openDrawer();
}

// ============ Fallback: browser print ============

export function browserPrintTicket(ticket: TicketData): void {
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-MX");
  const timeStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  let itemsHtml = "";
  for (const item of ticket.items) {
    const total = itemTotal(item);
    let detail = "";
    if (item.sale_type === "pieza" && item.is_fixed_price_piece) {
      detail = `${item.quantity} pza x $${money(Number(item.price) || 0)}`;
    } else {
      const kg = Number(item.prepared_kilos || item.kilos || 0);
      detail = `${kg.toFixed(3)}kg x $${money(Number(item.price) || 0)}`;
    }
    itemsHtml += `<tr><td>${item.product}<br><small>${detail}</small></td><td style="text-align:right">$${money(total)}</td></tr>`;
  }

  const qrHtml = ticket.qrData
    ? `<div style="text-align:center;margin:8px 0"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticket.qrData)}" style="width:120px;height:120px"/></div>`
    : "";

  const discountHtml = ticket.discount && ticket.discount > 0
    ? `<tr><td>Subtotal</td><td style="text-align:right">$${money(ticket.subtotal)}</td></tr>
       <tr><td>Descuento</td><td style="text-align:right">-$${money(ticket.discount)}</td></tr>`
    : "";

  const html = `<!DOCTYPE html><html><head><title>${ticket.folio}</title>
<style>
  @page{size:80mm auto;margin:0}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:4mm}
  h1{font-size:18px;text-align:center;margin-bottom:2px}
  h2{font-size:13px;text-align:center;margin-bottom:8px;font-weight:400}
  .sep{border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse}
  td{padding:2px 0;vertical-align:top}
  .total{font-size:16px;font-weight:700}
  .footer{text-align:center;font-size:10px;margin-top:8px}
  small{color:#555}
</style></head><body>
  <h1>SERGIO'S</h1>
  <h2>CARNICERIA</h2>
  <div class="sep"></div>
  <table>
    <tr><td><strong>${ticket.folio}</strong></td><td style="text-align:right">${dateStr} ${timeStr}</td></tr>
    ${ticket.customerName && ticket.customerName !== "PUBLICO GENERAL" ? `<tr><td colspan="2">Cliente: ${ticket.customerName}</td></tr>` : ""}
    ${ticket.attendant ? `<tr><td colspan="2">Atendio: ${ticket.attendant}</td></tr>` : ""}
    ${ticket.cashier ? `<tr><td colspan="2">Cajera: ${ticket.cashier}</td></tr>` : ""}
  </table>
  <div class="sep"></div>
  <table>${itemsHtml}</table>
  <div class="sep"></div>
  <table>
    ${discountHtml}
    <tr class="total"><td>TOTAL</td><td style="text-align:right">$${money(ticket.total)}</td></tr>
    ${ticket.paymentMethod ? `<tr><td>Pago</td><td style="text-align:right">${ticket.paymentMethod}</td></tr>` : ""}
    ${ticket.change && ticket.change > 0 ? `<tr><td>Cambio</td><td style="text-align:right">$${money(ticket.change)}</td></tr>` : ""}
  </table>
  ${qrHtml}
  <div class="sep"></div>
  <div class="footer">
    <div>sergioscarniceria.com</div>
    <div>Gracias por su compra!</div>
  </div>
  ${ticket.notes ? `<p style="margin-top:6px;font-size:10px">Nota: ${ticket.notes}</p>` : ""}
</body></html>`;

  const win = window.open("", "_blank", "width=350,height=600");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }
}

// ============ Smart print: ESC/POS si hay impresora, si no browser ============

export async function smartPrintTicket(ticket: TicketData): Promise<void> {
  const printer = getPrinter();

  // Si ya está conectada la impresora térmica, usar ESC/POS
  if (printer.isConnected) {
    const success = await printTicket(ticket);
    if (success) return;
    // Si falla, caer al browser print
  }

  // Si no hay impresora conectada o falló, usar browser print
  browserPrintTicket(ticket);
}
