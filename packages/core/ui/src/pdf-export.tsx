"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import {
  Document,
  Font,
  PDFDownloadLink,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { Download, FileText, Loader2 } from "lucide-react";
import React, { useCallback, useRef, useState } from "react";

import { Badge } from "./badge";
import { Button } from "./button";
import { cn } from "./lib/utils";

// Register fonts for PDF
Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyeMZs.woff2",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYeZs.woff2",
      fontWeight: 600,
    },
  ],
});

// PDF Styles
const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    padding: 30,
    backgroundColor: "#FFFFFF",
  },
  header: {
    marginBottom: 20,
    borderBottom: "1px solid #E5E7EB",
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 4,
    color: "#111827",
  },
  subtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 10,
  },
  metadata: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
  },
  metadataRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  metadataLabel: {
    width: 120,
    fontWeight: 600,
    color: "#374151",
  },
  metadataValue: {
    flex: 1,
    color: "#6B7280",
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderBottom: "1px solid #D1D5DB",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontWeight: 600,
    color: "#374151",
    fontSize: 9,
    textAlign: "left",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 24,
  },
  tableCell: {
    fontSize: 8,
    color: "#111827",
    textAlign: "left",
    flexWrap: "wrap",
    paddingRight: 4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: "center",
    borderTop: "1px solid #E5E7EB",
    paddingTop: 10,
  },
  pageNumber: {
    fontSize: 8,
    color: "#6B7280",
  },
});

// Types with proper generics
export interface PDFColumn {
  key: string;
  header: string;
  width?: string;
  getValue?: (row: Record<string, unknown>) => string;
}

export interface PDFExportConfig {
  title: string;
  subtitle?: string;
  filename: string;
  data: Record<string, unknown>[];
  columns: PDFColumn[];
  pageOrientation?: "portrait" | "landscape";
  enablePageBreaks?: boolean;
  headerOnEveryPage?: boolean;
  includeMetadata?: boolean;
  customMetadata?: Record<string, string>;
  // Custom actions for the preview dialog
  customActions?: {
    label: string;
    variant?:
      | "primary"
      | "destructive"
      | "outline"
      | "secondary"
      | "ghost"
      | "link";
    icon?: React.ReactNode;
    onClick: (pdfBlob: Blob, filename: string) => Promise<void> | void;
    disabled?: boolean;
  }[];
  // Control whether to show the default "Save to Computer" button
  showSaveButton?: boolean;
}

// Helper function to get cell value safely
const getCellValue = (
  row: Record<string, unknown>,
  column: PDFColumn,
): string => {
  if (column.getValue) {
    const result = column.getValue(row);
    return result ?? "";
  }
  const value = row[column.key];
  if (value == null) return "";

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  // For complex objects, attempt to extract meaningful content
  if (typeof value === "object" && value !== null) {
    // If it has a toString method that's not the default Object.prototype.toString
    if (value.toString !== Object.prototype.toString) {
      return value.toString();
    }
    // Try to extract a name, title, or label property
    const obj = value as Record<string, unknown>;
    return String(obj.name ?? obj.title ?? obj.label ?? obj.id ?? "[Object]");
  }

  return String(value);
};

// Table Header Component - can be reused across pages
function TableHeader({ columns }: { columns: PDFColumn[] }) {
  return (
    <View style={styles.tableHeader}>
      {columns.map((column) => (
        <Text
          key={column.key}
          style={[
            styles.tableHeaderCell,
            { width: column.width ?? `${100 / columns.length}%` },
          ]}
        >
          {column.header}
        </Text>
      ))}
    </View>
  );
}

// Table Row Component
function TableRow({
  row,
  columns,
  rowIndex: _rowIndex,
}: {
  row: Record<string, unknown>;
  columns: PDFColumn[];
  rowIndex: number;
}) {
  return (
    <View style={styles.tableRow}>
      {columns.map((column) => (
        <Text
          key={column.key}
          style={[
            styles.tableCell,
            { width: column.width ?? `${100 / columns.length}%` },
          ]}
        >
          {getCellValue(row, column)}
        </Text>
      ))}
    </View>
  );
}

// Table Row Group for better performance with large datasets
function TableRowGroup({
  rows,
  columns,
  startIndex,
}: {
  rows: Record<string, unknown>[];
  columns: PDFColumn[];
  startIndex: number;
}) {
  return (
    <View>
      {rows.map((row, index) => (
        <TableRow
          key={startIndex + index}
          row={row}
          columns={columns}
          rowIndex={startIndex + index}
        />
      ))}
    </View>
  );
}

// PDF Document Component
export function PDFDocument({
  title,
  subtitle,
  data,
  columns,
  pageOrientation = "portrait",
  includeMetadata = true,
  customMetadata,
}: PDFExportConfig) {
  const rowsPerPage = 25; // Adjust based on your needs
  const pageCount = Math.ceil(data.length / rowsPerPage);

  return (
    <Document>
      <Page size="A4" orientation={pageOrientation} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {/* Metadata */}
        {includeMetadata && customMetadata && (
          <View style={styles.metadata}>
            {Object.entries(customMetadata).map(([key, value]) => (
              <View key={key} style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>{key}:</Text>
                <Text style={styles.metadataValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Table */}
        <View style={styles.table}>
          <TableHeader columns={columns} />
          {Array.from({ length: pageCount }, (_, pageIndex) => {
            const startIndex = pageIndex * rowsPerPage;
            const endIndex = Math.min(startIndex + rowsPerPage, data.length);
            const pageRows = data.slice(startIndex, endIndex);

            return (
              <TableRowGroup
                key={pageIndex}
                rows={pageRows}
                columns={columns}
                startIndex={startIndex}
              />
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

// Separated PDF Preview Component (can be used in multi-page dialogs)
export interface PDFPreviewProps {
  config: PDFExportConfig;
  pdfBlob: Blob | null;
  isGenerating: boolean;
  onCustomAction?: (
    action: NonNullable<PDFExportConfig["customActions"]>[0],
  ) => Promise<void>;
  onSave?: () => void;
  showActions?: boolean;
  className?: string;
}

export function PDFPreview({
  config,
  pdfBlob,
  isGenerating,
  onCustomAction,
  onSave,
  showActions = true,
  className,
}: PDFPreviewProps) {
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  const handleSave = () => {
    if (!pdfBlob || !config) return;

    setIsActionLoading("save");
    try {
      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = config.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onSave?.();
    } catch (error) {
      console.error("Error saving PDF:", error);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleCustomAction = async (
    action: NonNullable<PDFExportConfig["customActions"]>[0],
  ) => {
    console.log("handleCustomAction", action);
    if (!pdfBlob || !config) return;

    setIsActionLoading(action.label);
    try {
      await action.onClick(pdfBlob, config.filename);
      onCustomAction?.(action);
    } catch (error) {
      console.error("Custom action error:", error);
    } finally {
      setIsActionLoading(null);
    }
  };

  if (!config) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* PDF Preview Area */}
      <div className="rounded-lg border bg-gray-50 p-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Preview Header */}
          <div className="text-center">
            <FileText className="mx-auto h-16 w-16 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {config.title}
            </h3>
            {config.subtitle && (
              <p className="mt-1 text-sm text-gray-500">{config.subtitle}</p>
            )}
          </div>

          {/* PDF Stats */}
          <div className="flex justify-center space-x-8 border-t border-gray-200 pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {config.data.length}
              </div>
              <div className="text-sm text-gray-500">Records</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {config.columns.length}
              </div>
              <div className="text-sm text-gray-500">Columns</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {Math.ceil(config.data.length / 25)}
              </div>
              <div className="text-sm text-gray-500">Pages</div>
            </div>
          </div>

          {/* Generation Status */}
          {isGenerating && (
            <div className="flex items-center justify-center space-x-2 rounded-lg bg-blue-50 p-4">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Generating PDF...
              </span>
            </div>
          )}

          {/* Ready Status */}
          {pdfBlob && !isGenerating && (
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <span className="text-sm font-medium text-green-900">
                ✓ PDF ready for download ({(pdfBlob.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex flex-wrap justify-center gap-3">
          {/* Custom Actions */}
          {config.customActions?.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? "outline"}
              onClick={() => handleCustomAction(action)}
              disabled={
                (action.disabled ?? false) ||
                isActionLoading === action.label ||
                !pdfBlob
              }
            >
              {isActionLoading === action.label ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </>
              )}
            </Button>
          ))}

          {/* Default Save Button */}
          {(config.showSaveButton ?? true) && (
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!pdfBlob || isActionLoading === "save"}
            >
              {isActionLoading === "save" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Save to Computer
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Standalone PDF Preview Dialog Component
function PDFPreviewDialog({
  isOpen,
  onClose,
  config,
  pdfBlob,
  isGenerating,
}: {
  isOpen: boolean;
  onClose: () => void;
  config: PDFExportConfig | null;
  pdfBlob: Blob | null;
  isGenerating: boolean;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PDF Export Preview
            {config && (
              <Badge variant="outline" className="ml-2">
                {config.filename}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {config && (
          <PDFPreview
            config={config}
            pdfBlob={pdfBlob}
            isGenerating={isGenerating}
            onSave={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Basic PDF Export Hook (no preview)
export function usePDFExport() {
  const [isGenerating, setIsGenerating] = useState(false);

  const exportToPDF = useCallback(async (config: PDFExportConfig) => {
    setIsGenerating(true);
    try {
      const doc = <PDFDocument {...config} />;
      const blob = await pdf(doc).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = config.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return blob;
    } catch (error) {
      console.error("PDF generation error:", error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { exportToPDF, isGenerating };
}

// PDF Export Hook with Preview Dialog
export function usePDFExportWithPreview() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<PDFExportConfig | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const openPreview = useCallback(async (exportConfig: PDFExportConfig) => {
    setConfig(exportConfig);
    setIsOpen(true);
    setIsGenerating(true);
    setPdfBlob(null);

    try {
      const doc = <PDFDocument {...exportConfig} />;
      const blob = await pdf(doc).toBlob();
      setPdfBlob(blob);
    } catch (error) {
      console.error("PDF generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const closePreview = useCallback(() => {
    setIsOpen(false);
    setConfig(null);
    setPdfBlob(null);
    setIsGenerating(false);
  }, []);

  const PreviewDialog = useCallback(
    () => (
      <PDFPreviewDialog
        isOpen={isOpen}
        onClose={closePreview}
        config={config}
        pdfBlob={pdfBlob}
        isGenerating={isGenerating}
      />
    ),
    [isOpen, closePreview, config, pdfBlob, isGenerating],
  );

  return { openPreview, closePreview, PreviewDialog, isGenerating };
}

// Simple PDF Export Button Component
interface PDFExportButtonProps {
  config: PDFExportConfig;
  variant?: "download" | "preview";
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function PDFExportButton({
  config,
  variant = "download",
  children,
  className,
  disabled,
  onSuccess,
  onError,
}: PDFExportButtonProps) {
  const { exportToPDF, isGenerating } = usePDFExport();

  const handleClick = async () => {
    try {
      await exportToPDF(config);
      onSuccess?.();
    } catch (error) {
      onError?.(error as Error);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={(disabled ?? false) || isGenerating}
      className={className}
    >
      {isGenerating
        ? "Generating..."
        : (children ??
          `${variant === "download" ? "Download" : "Preview"} PDF`)}
    </button>
  );
}

// PDF Export Button with Preview Dialog
interface PDFExportWithPreviewButtonProps {
  config: PDFExportConfig;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function PDFExportWithPreviewButton({
  config,
  children,
  className,
  disabled,
  onSuccess,
  onError,
}: PDFExportWithPreviewButtonProps) {
  const { openPreview, PreviewDialog, isGenerating } =
    usePDFExportWithPreview();

  const handleClick = () => {
    try {
      openPreview(config);
      onSuccess?.();
    } catch (error) {
      onError?.(error as Error);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={(disabled ?? false) || isGenerating}
        className={className}
      >
        {isGenerating ? "Generating..." : (children ?? "Export PDF")}
      </button>
      <PreviewDialog />
    </>
  );
}

// Helper function to convert EntityList columns to PDF columns with proper typing
interface EntityListColumn {
  accessorKey?: string;
  header?: string | React.ReactNode;
  id?: string;
  cell?: unknown;
}

export function convertToPDFColumns(
  entityListColumns: EntityListColumn[],
): PDFColumn[] {
  return entityListColumns
    .filter((col): col is EntityListColumn & { accessorKey: string } =>
      Boolean(col.accessorKey),
    )
    .map((col) => ({
      key: col.accessorKey,
      header:
        typeof col.header === "string"
          ? col.header
          : (col.id ?? col.accessorKey),
      getValue: col.cell
        ? undefined
        : (row: Record<string, unknown>) => {
            const value = row[col.accessorKey];
            return value?.toString() ?? "";
          },
    }));
}
