/**
 * Tool Types for Agentic Chat
 * OpenAI-compatible function calling types and interfaces
 */

// ==================== OpenAI Function Calling Types ====================

/**
 * Tool definition in OpenAI format
 */
export interface ToolDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, ToolParameterSchema>;
            required?: string[];
        };
    };
}

/**
 * JSON Schema for tool parameters
 */
export interface ToolParameterSchema {
    type: "string" | "number" | "integer" | "boolean" | "array" | "object";
    description?: string;
    enum?: string[];
    items?: ToolParameterSchema;
    properties?: Record<string, ToolParameterSchema>;
    required?: string[];
    default?: unknown;
}

/**
 * Tool call from API response
 */
export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;  // JSON string
    };
}

/**
 * Parsed tool call with typed arguments
 */
export interface ParsedToolCall<T = Record<string, unknown>> {
    id: string;
    name: string;
    arguments: T;
}

/**
 * Tool execution result
 */
export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
    /** Human-readable summary for UI display */
    summary?: string;
}

/**
 * Message with tool call (assistant response)
 */
export interface ToolCallMessage {
    role: "assistant";
    content: string | null;
    tool_calls: ToolCall[];
}

/**
 * Message with tool result (to send back)
 */
export interface ToolResultMessage {
    role: "tool";
    tool_call_id: string;
    content: string;  // JSON stringified result
}

// ==================== Agent Configuration ====================

/**
 * Library scope options
 */
export type LibraryScope =
    | { type: "user" }                                      // User's personal library
    | { type: "group"; groupId: number }                    // Specific group library  
    | { type: "collection"; collectionId: number }          // Specific collection
    | { type: "all" };                                      // All accessible libraries

/**
 * Tool sensitivity levels for human-in-the-loop gates
 * @see agentic.md Section 8.5 - Security via Human-in-the-Loop
 */
export enum ToolSensitivity {
    /** Safe read-only operations - auto-execute */
    READ = "read",
    /** Modifications that can be undone - warn but allow */
    WRITE = "write",
    /** Destructive or irreversible operations - require confirmation */
    DESTRUCTIVE = "destructive",
}

/**
 * Agent runtime state for stateful reasoning loops
 * @see agentic.md Section 8.2 - The Typed State Definition
 */
export interface AgentState {
    /** Current iteration count in the agent loop */
    iteration: number;
    /** Retry counts per tool call ID */
    retryCount: Map<string, number>;
    /** Total tool calls executed in this session */
    totalToolCalls: number;
    /** Failed tool calls in this session */
    failedToolCalls: number;
    /** Whether human approval is required for next action */
    pendingApproval: boolean;
    /** Tool awaiting approval (if any) */
    pendingToolCall?: ToolCall;
}

/**
 * Create initial agent state
 */
export function createInitialAgentState(): AgentState {
    return {
        iteration: 0,
        retryCount: new Map(),
        totalToolCalls: 0,
        failedToolCalls: 0,
        pendingApproval: false,
    };
}

/**
 * Agent configuration
 */
export interface AgentConfig {
    /** Library scope for search/operations */
    libraryScope: LibraryScope;
    /** Maximum items to return from searches */
    maxSearchResults: number;
    /** Whether to include PDF content by default */
    includeContent: boolean;
    /** Maximum content length per item */
    maxContentLength: number;
    /** Maximum number of tool iterations */
    maxAgentIterations: number;
    /** Maximum retries for a single tool call before giving up */
    maxToolRetries: number;
    /** Whether to automatically trigger OCR when importing papers or reading content */
    autoOcr: boolean;
    /** Whether to require human approval for destructive operations */
    requireApprovalForDestructive: boolean;
    /** Handler for inline permission requests */
    permissionHandler?: (toolCallId: string, toolName: string) => Promise<boolean>;
}

export const defaultAgentConfig: AgentConfig = {
    libraryScope: { type: "user" },
    maxSearchResults: 20,
    includeContent: true,
    maxContentLength: 50000,
    maxAgentIterations: 1000,
    maxToolRetries: 2,
    autoOcr: false,
    requireApprovalForDestructive: false,
};

// ==================== Tool-Specific Parameter Types ====================

/**
 * Parameters for search_library tool
 */
export interface SearchLibraryParams {
    query: string;
    filters?: {
        year_from?: number;
        year_to?: number;
        authors?: string[];
        tags?: string[];
        collection?: string;
        item_types?: string[];
    };
    limit?: number;
}

/**
 * Parameters for get_item_metadata tool
 */
export interface GetItemMetadataParams {
    item_id: number;
}

/**
 * Parameters for read_item_content tool
 */
export interface ReadItemContentParams {
    item_id: number;
    include_notes?: boolean;
    include_pdf?: boolean;
    trigger_ocr?: boolean; // If true, triggers OCR if no text content found
    max_length?: number;
}

/**
 * Parameters for create_note tool
 */
export interface CreateNoteParams {
    parent_item_id?: number;
    collection_id?: number; // Create an orphan note in a collection
    title: string;
    content: string;
    tags?: string[];
}

/**
 * Parameters for add_to_context tool
 */
export interface AddToContextParams {
    items: Array<{
        type: "paper" | "tag" | "author" | "collection" | "topic" | "table";
        id?: number | string;
        name?: string;
    }>;
}

/**
 * Parameters for remove_from_context tool
 */
export interface RemoveFromContextParams {
    items: Array<{
        type: "paper" | "tag" | "author" | "collection" | "topic" | "table";
        id?: number | string;
    }>;
}

/**
 * Parameters for create_table tool
 */
export interface CreateTableParams {
    name: string;
    item_ids?: number[]; // Optional: initial papers to add
}

/**
 * Parameters for add_to_table tool
 */
export interface AddToTableParams {
    table_id: string;
    item_ids: number[];
}

/**
 * Parameters for list_tables tool
 */
export interface ListTablesParams {
    // No parameters needed
}

/**
 * Parameters for create_table_column tool
 */
export interface CreateTableColumnParams {
    table_id: string;
    column_name: string;
    ai_prompt: string;
}

/**
 * Parameters for generate_table_data tool
 */
export interface GenerateTableDataParams {
    table_id: string;
    column_id?: string;  // If not provided, generate all columns
    item_ids?: number[]; // If not provided, generate for all items
}

/**
 * Parameters for read_table tool
 */
export interface ReadTableParams {
    table_id?: string;  // If not provided, reads the most recent/active table
    include_data?: boolean; // If true, includes all generated cell data (default: true)
}

/**
 * Parameters for search_external tool (Semantic Scholar)
 */
export interface SearchExternalParams {
    query: string;
    year?: string;           // "2020-2024" or "2023-"
    limit?: number;          // Default 10
    openAccessPdf?: boolean; // Only papers with PDFs
}

/**
 * Parameters for import_paper tool
 */
export interface ImportPaperParams {
    paper_id: string;         // Semantic Scholar paper ID
    target_collection_id?: number;
    trigger_ocr?: boolean;    // Automatically trigger OCR after import
    wait_for_pdf?: boolean;   // Whether to wait for PDF discovery/OCR before returning (default: true)
}

/**
 * Parameters for move_item tool
 */
export interface MoveItemParams {
    item_id: number;
    target_collection_id: number;
    remove_from_others?: boolean;
}

/**
 * Parameters for remove_item_from_collection tool
 */
export interface RemoveItemFromCollectionParams {
    item_id: number;
    collection_id: number;
}

/**
 * Parameters for find_collection tool
 */
export interface FindCollectionParams {
    name: string;
    library_id?: number;
    parent_collection_id?: number; // Search within a specific folder
}

/**
 * Parameters for create_collection tool
 */
export interface CreateCollectionParams {
    name: string;
    parent_collection_id?: number;
    library_id?: number;
}

/**
 * Parameters for list_collection tool
 */
export interface ListCollectionParams {
    collection_id: number;
}

// ==================== Tool Result Types ====================

/**
 * Result from search_library
 */
export interface SearchLibraryResult {
    items: Array<{
        id: number;
        title: string;
        authors: string[];
        year: string;
        abstract_preview: string;
        tags: string[];
        item_type: string;
    }>;
    total_count: number;
}

/**
 * Result from get_item_metadata
 */
export interface GetItemMetadataResult {
    id: number;
    title: string;
    authors: Array<{
        firstName: string;
        lastName: string;
        creatorType: string;
    }>;
    year: string;
    abstract: string;
    doi?: string;
    url?: string;
    publication?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    tags: string[];
    collections: string[];
    item_type: string;
    date_added: string;
    date_modified: string;
    has_pdf: boolean;
    notes_count: number;
}

/**
 * Result from read_item_content
 */
export interface ReadItemContentResult {
    content: string;
    source_type: "notes" | "indexed_pdf" | "ocr" | "metadata_only";
    notes_count: number;
    content_length: number;
    truncated: boolean;
}

/**
 * Result from create_note
 */
export interface CreateNoteResult {
    note_id: number;
    parent_item_id?: number;
}

/**
 * Result from context operations
 */
export interface ContextOperationResult {
    added?: number;
    removed?: number;
    current_items: Array<{
        type: string;
        name: string;
    }>;
}

/**
 * Result from search_external
 */
export interface SearchExternalResult {
    total: number;
    papers: Array<{
        paperId: string;
        title: string;
        authors: string[];
        year?: number;
        abstract?: string;
        citationCount: number;
        url: string;
        has_pdf: boolean;
    }>;
}

/**
 * Result from import_paper
 */
export interface ImportPaperResult {
    item_id: number;
    title: string;
    pdf_attached: boolean;
    success: boolean;
}

/**
 * Result from find_collection
 */
export interface FindCollectionResult {
    collections: Array<{
        id: number;
        name: string;
        library_id: number;
        path: string;
    }>;
}

/**
 * Result from create_collection
 */
export interface CreateCollectionResult {
    collection_id: number;
    name: string;
}

/**
 * Result from list_collection
 */
export interface ListCollectionResult {
    items: Array<{
        id: number | string;
        title: string;
        type: string;
        details?: string;
    }>;
}

/**
 * Result from create_table
 */
export interface CreateTableResult {
    table_id: string;
    name: string;
}

/**
 * Result from add_to_table
 */
export interface AddToTableResult {
    table_id: string;
    added_count: number;
}

/**
 * Result from list_tables
 */
export interface ListTablesResult {
    tables: Array<{
        id: string;
        name: string;
        columns: string[];
        item_count: number;
    }>;
}

/**
 * Result from create_table_column
 */
export interface CreateTableColumnResult {
    column_id: string;
    table_id: string;
    column_name: string;
}

/**
 * Result from generate_table_data
 */
export interface GenerateTableDataResult {
    generated_count: number;
    table_id: string;
}

/**
 * Result from read_table
 */
export interface ReadTableResult {
    table_id: string;
    name: string;
    columns: Array<{
        id: string;
        name: string;
        ai_prompt?: string;
    }>;
    rows: Array<{
        item_id: number;
        title: string;
        data: Record<string, string>;
    }>;
    total_rows: number;
}

// ==================== Web & Citation Tool Types ====================

/**
 * Parameters for search_web tool (Firecrawl)
 */
export interface SearchWebParams {
    query: string;
    limit?: number; // Default 5
}

/**
 * Parameters for read_webpage tool (Firecrawl)
 */
export interface ReadWebPageParams {
    url: string;
}

/**
 * Parameters for get_citations tool (Semantic Scholar)
 */
export interface GetCitationsParams {
    paper_id: string; // Semantic Scholar Paper ID
    limit?: number;   // Default 10
}

/**
 * Parameters for get_references tool (Semantic Scholar)
 */
export interface GetReferencesParams {
    paper_id: string; // Semantic Scholar Paper ID
    limit?: number;   // Default 10
}

/**
 * Result from search_web
 */
export interface SearchWebResult {
    results: Array<{
        title: string;
        url: string;
        description: string;
    }>;
    total: number;
}

/**
 * Result from read_webpage
 */
export interface ReadWebPageResult {
    markdown: string;
    title?: string;
    url: string;
}

/**
 * Result from get_citations
 */
export interface GetCitationsResult {
    total: number;
    papers: Array<{
        paperId: string;
        title: string;
        authors: string[];
        year?: number;
        citationCount: number;
        url: string;
        has_pdf: boolean;
        intent?: string; // e.g. "methodology", "background"
    }>;
}

/**
 * Result from get_references
 */
export interface GetReferencesResult {
    total: number;
    papers: Array<{
        paperId: string;
        title: string;
        authors: string[];
        year?: number;
        citationCount: number;
        url: string;
        has_pdf: boolean;
        isInfluential?: boolean;
    }>;
}

// ==================== Tool Name Constants ====================

export const TOOL_NAMES = {
    SEARCH_LIBRARY: "search_library",
    GET_ITEM_METADATA: "get_item_metadata",
    READ_ITEM_CONTENT: "read_item_content",
    CREATE_NOTE: "create_note",
    ADD_TO_CONTEXT: "add_to_context",
    REMOVE_FROM_CONTEXT: "remove_from_context",
    LIST_CONTEXT: "list_context",
    LIST_TABLES: "list_tables",
    CREATE_TABLE: "create_table",
    ADD_TO_TABLE: "add_to_table",
    CREATE_TABLE_COLUMN: "create_table_column",
    GENERATE_TABLE_DATA: "generate_table_data",
    READ_TABLE: "read_table",
    SEARCH_EXTERNAL: "search_external",
    IMPORT_PAPER: "import_paper",
    MOVE_ITEM: "move_item",
    REMOVE_ITEM_FROM_COLLECTION: "remove_item_from_collection",
    FIND_COLLECTION: "find_collection",
    CREATE_COLLECTION: "create_collection",
    LIST_COLLECTION: "list_collection",
    // New Tools
    SEARCH_WEB: "search_web",
    READ_WEBPAGE: "read_webpage",
    GET_CITATIONS: "get_citations",
    GET_REFERENCES: "get_references",
} as const;

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];
