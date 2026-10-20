import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { PCI_LABELS } from "@/types/pci";
import { DEFECT_LABELS_PL } from "@/types/analysis";
import type { ReportExportPayload } from "@/lib/pdf/reportTypes";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  brand: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 16,
  },
  pciBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    marginBottom: 16,
  },
  pciScore: {
    width: 40,
    height: 40,
    borderRadius: 6,
    color: "#ffffff",
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    paddingTop: 10,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 9,
    letterSpacing: 1,
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: 6,
    fontFamily: "Helvetica-Bold",
  },
  body: {
    lineHeight: 1.45,
    color: "#374151",
  },
  bullet: {
    marginBottom: 3,
    paddingLeft: 8,
    color: "#374151",
  },
  meta: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    fontSize: 8,
    color: "#9ca3af",
  },
  row: {
    flexDirection: "row",
    marginBottom: 2,
  },
  label: {
    width: 90,
    color: "#6b7280",
  },
});

const PCI_HEX: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "#DC2626",
  2: "#F97316",
  3: "#EAB308",
  4: "#84CC16",
  5: "#16A34A",
};

export function ReportDocument({ data }: { data: ReportExportPayload }) {
  const { result, report, road } = data;
  const roadLabel =
    road?.ref || road?.name || report.roadId.slice(0, 8);

  return (
    <Document
      title={`RoadEye AI — PCI ${result.pciScore} — ${roadLabel}`}
      author="RoadEye AI"
      subject="Raport stanu nawierzchni"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>RoadEye AI · Raport nawierzchni</Text>
        <Text style={styles.title}>
          PCI {result.pciScore} — {PCI_LABELS[result.pciScore]}
        </Text>
        <Text style={styles.subtitle}>
          {road?.ref ? `${road.ref}` : "Odcinek"}
          {road?.name ? ` · ${road.name}` : ""}
          {road?.roadClass ? ` · ${road.roadClass}` : ""}
        </Text>

        <View style={styles.pciBox}>
          <Text
            style={[
              styles.pciScore,
              { backgroundColor: PCI_HEX[result.pciScore] },
            ]}
          >
            {result.pciScore}
          </Text>
          <View>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>
              Pewność {(result.confidenceScore * 100).toFixed(0)}%
            </Text>
            <Text style={styles.body}>{result.conditionDescription}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Defekty powierzchni</Text>
          {result.surfaceDefects.length === 0 ? (
            <Text style={styles.body}>Brak wykrytych anomalii.</Text>
          ) : (
            result.surfaceDefects.map((d, i) => (
              <Text
                key={`${d.type}-${d.locationHint}-${i}`}
                style={styles.bullet}
              >
                • {DEFECT_LABELS_PL[d.type]} · sev {d.severity} —{" "}
                {d.locationHint}
                {typeof d.lat === "number" && typeof d.lng === "number"
                  ? ` (${d.lat.toFixed(5)}, ${d.lng.toFixed(5)})`
                  : ""}
              </Text>
            ))
          )}
        </View>

        <ListSection title="Prawdopodobne przyczyny" items={result.probableCauses} />
        <ListSection title="Rekomendacje" items={result.recommendations} />
        <ListSection title="Zagrożenia" items={result.potentialHazards} />

        <View style={styles.meta}>
          <View style={styles.row}>
            <Text style={styles.label}>Report ID</Text>
            <Text>{report.id}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Model</Text>
            <Text>
              {report.provider ? `${report.provider} / ` : ""}
              {report.modelId}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Analiza</Text>
            <Text>{new Date(report.createdAt).toLocaleString("pl-PL")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Eksport</Text>
            <Text>{new Date(data.generatedAt).toLocaleString("pl-PL")}</Text>
          </View>
          {road?.osmId ? (
            <View style={styles.row}>
              <Text style={styles.label}>OSM</Text>
              <Text>{road.osmId}</Text>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.body}>—</Text>
      ) : (
        items.map((item) => (
          <Text key={item} style={styles.bullet}>
            • {item}
          </Text>
        ))
      )}
    </View>
  );
}
