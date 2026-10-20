import { renderToBuffer } from "@react-pdf/renderer";
import { ReportDocument } from "@/lib/pdf/ReportDocument";
import type { ReportExportPayload } from "@/lib/pdf/reportTypes";

export async function renderReportPdf(
  data: ReportExportPayload,
): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<ReportDocument data={data} />);
  return new Uint8Array(buffer);
}
