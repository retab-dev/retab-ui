import { create } from "zustand";

interface TabState {
  // Top-level tabs across the project page
  tabValue: "playground" | "deployment" | "enhance";
  setTabValue: (value: "playground" | "deployment" | "enhance") => void;
  activeView: "table" | "form" | "metrics" | "code" | "likelihoods" | "parent";
  activeEvaluationTab: "timeline" | "dataset" | "iterations";
  isExtracting: Record<string, boolean>;
  isGeneratingSchema: boolean;
  showInfoPanel: boolean;
  docId: string | null;
  hoverFieldPath: string | null;
  selectedFieldPath: string | null;
  metricsSelection: string | null;
  metricsSelectedDocumentId: string | null;
  metricsViewedDocumentId: string | null;
  metricsAlignmentKeyPath: string | null;
  documentExtractionStatus: Record<string, "scheduled" | "running">;
  isProcessingGroundTruth: boolean;
  processingIterations: Set<string>;
  consensusEnabled: boolean;
  cellColorState: "none" | "consensus" | "similarity" | "mismatch";
  setConsensusEnabled: (consensusEnabled: boolean) => void;
  setCellColorState: (
    state: "none" | "consensus" | "similarity" | "mismatch",
  ) => void;
  setShowInfoPanel: (show: boolean) => void;
  showSchemaEditor: boolean;
  setShowSchemaEditor: (show: boolean) => void;
  setActiveView: (
    view: "table" | "form" | "metrics" | "code" | "likelihoods" | "parent",
  ) => void;
  setActiveEvaluationTab: (tab: "timeline" | "dataset" | "iterations") => void;
  setDocumentExtractionStatus: (
    documentId: string,
    iterationId: string | null,
    status: "scheduled" | "running" | "completed",
  ) => void;
  setIsGeneratingSchema: (isGenerating: boolean) => void;
  setDocId: (docId: string | null) => void;
  setHoverFieldPath: (fieldPath: string | null) => void;
  setSelectedFieldPath: (fieldPath: string | null) => void;
  setMetricsSelection: (field: string | null) => void;
  setMetricsSelectedDocumentId: (documentId: string | null) => void;
  setMetricsViewedDocumentId: (documentId: string | null) => void;
  setMetricsAlignmentKeyPath: (keyPath: string | null) => void;
  getDocumentStatus: (
    documentId: string,
    iterationId?: string | null,
  ) => "scheduled" | "running" | "completed";
  // Reset extraction/schema generation state when navigating between projects
  resetForProjectChange: () => void;
}

export const useTabStateStore = create<TabState>((set, get) => ({
  tabValue: "playground",
  setTabValue: (value) => set({ tabValue: value }),
  activeView: "table",
  activeEvaluationTab: "timeline",
  showInfoPanel: true,
  docId: null,
  hoverFieldPath: null,
  selectedFieldPath: null,
  metricsSelection: null,
  metricsSelectedDocumentId: null,
  metricsViewedDocumentId: null,
  metricsAlignmentKeyPath: null,
  documentExtractionStatus: {},
  isGeneratingSchema: false,
  isExtracting: {},
  isProcessingGroundTruth: false,
  processingIterations: new Set(),
  showSchemaEditor: false,
  consensusEnabled: false,
  cellColorState: "none",
  setConsensusEnabled: (consensusEnabled) => set({ consensusEnabled }),
  setCellColorState: (state) => set({ cellColorState: state }),
  setShowInfoPanel: (show) => set({ showInfoPanel: show }),
  setShowSchemaEditor: (show) => set({ showSchemaEditor: show }),
  getDocumentStatus: (documentId, iterationId) => {
    const key = iterationId ? `${iterationId}-${documentId}` : `${documentId}`;
    const status = get().documentExtractionStatus[key];
    // Return "completed" if the key doesn't exist (meaning it finished and was cleaned up)
    return status || "completed";
  },

  setActiveView: (view) => {
    set({ activeView: view });
  },

  setActiveEvaluationTab: (tab) => {
    set({ activeEvaluationTab: tab });
  },

  setDocumentExtractionStatus: (documentId, iterationId, status) => {
    const key = iterationId
      ? `${iterationId}-${documentId}`
      : `dataset-${documentId}`;
    const currentStatus = get().documentExtractionStatus;

    let newDocumentExtractionStatus: Record<string, "scheduled" | "running">;
    const newProcessingIterations = new Set(get().processingIterations);

    if (status === "completed") {
      // Create new object without the completed key
      const { [key]: _, ...remaining } = currentStatus;
      newDocumentExtractionStatus = remaining;

      // Handle processing iterations immutably
      if (iterationId) {
        const hasActiveExtractions = Object.keys(
          newDocumentExtractionStatus,
        ).some((key) => key.includes(iterationId));
        if (!hasActiveExtractions) {
          newProcessingIterations.delete(iterationId);
        }
      }
    } else {
      // Add/update the status
      newDocumentExtractionStatus = {
        ...currentStatus,
        [key]: status,
      };

      // Handle processing iterations immutably
      if (iterationId) {
        newProcessingIterations.add(iterationId);
      }

      // This function will handle unexpected statuses where a document was scheduled but never ran, or it was running but never completed...
      // If the status did not change after 10 minutes, set it to completed
      setTimeout(() => {
        const currentDocumentExtractionStatus = get().documentExtractionStatus;
        if (currentDocumentExtractionStatus[key] === status) {
          // Still scheduled.
          console.log(
            `${documentId} under iteration=${iterationId} is still ${status}. Setting to completed.`,
          );
          get().setDocumentExtractionStatus(
            documentId,
            iterationId,
            "completed",
          );
        }
      }, 600000);
    }

    // Update all state in one call
    const isExtractingByIteration: Record<string, boolean> = {};
    newProcessingIterations.forEach((iterationId) => {
      isExtractingByIteration[iterationId] = true;
    });

    set({
      processingIterations: newProcessingIterations,
      documentExtractionStatus: newDocumentExtractionStatus,
      isExtracting: isExtractingByIteration,
      isProcessingGroundTruth: Object.keys(newDocumentExtractionStatus).some(
        (key) => key.includes("dataset"),
      ),
    });
  },

  setIsGeneratingSchema: (isGenerating) => {
    // Update schema generation status
    set({
      isGeneratingSchema: isGenerating,
    });
  },

  setDocId: (docId) => set({ docId }),
  setHoverFieldPath: (fieldPath) => set({ hoverFieldPath: fieldPath }),
  setSelectedFieldPath: (fieldPath) =>
    set({ selectedFieldPath: fieldPath, hoverFieldPath: fieldPath }),
  setMetricsSelection: (field) => set({ metricsSelection: field }),
  setMetricsSelectedDocumentId: (documentId) =>
    set({ metricsSelectedDocumentId: documentId }),
  setMetricsViewedDocumentId: (documentId) =>
    set({ metricsViewedDocumentId: documentId }),
  setMetricsAlignmentKeyPath: (keyPath) =>
    set({ metricsAlignmentKeyPath: keyPath }),
  resetForProjectChange: () => {
    // Clear all extraction-related state and schema generation flag on project change
    set({
      documentExtractionStatus: {},
      processingIterations: new Set(),
      isExtracting: {},
      isProcessingGroundTruth: false,
      isGeneratingSchema: false,
    });
  },
}));
