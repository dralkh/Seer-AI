/**
 * MCP Tool Definitions
 * 
 * Defines all 20 Seer-AI tools in MCP format.
 */

import { z } from "zod";

// Tool parameter schemas
const searchLibraryParams = z.object({
    query: z.string().describe("Search query for titles, authors, abstracts, and full text"),
    filters: z.object({
        year_from: z.number().optional().describe("Minimum publication year"),
        year_to: z.number().optional().describe("Maximum publication year"),
        authors: z.array(z.string()).optional().describe("Filter by author names"),
        tags: z.array(z.string()).optional().describe("Filter by tags"),
        collection: z.string().optional().describe("Filter by collection name"),
        item_types: z.array(z.string()).optional().describe("Filter by item types"),
    }).optional().describe("Optional filters"),
    limit: z.number().min(1).max(50).default(10).optional().describe("Max results (default: 10)"),
});

const getItemMetadataParams = z.object({
    item_id: z.number().describe("Zotero item ID"),
});

const readItemContentParams = z.object({
    item_id: z.number().describe("Zotero item ID"),
    include_notes: z.boolean().default(true).optional().describe("Include notes"),
    include_pdf: z.boolean().default(true).optional().describe("Include PDF text"),
    trigger_ocr: z.boolean().default(false).optional().describe("Trigger OCR if needed"),
    max_length: z.number().default(0).optional().describe("Max content length (0 = no limit)"),
});

const createNoteParams = z.object({
    parent_item_id: z.number().optional().describe("Parent item ID for attachment"),
    collection_id: z.number().optional().describe("Collection ID for standalone note"),
    title: z.string().describe("Note title"),
    content: z.string().describe("Note content (markdown supported)"),
    tags: z.array(z.string()).optional().describe("Tags to add"),
});

const contextItemParams = z.object({
    items: z.array(z.object({
        type: z.enum(["paper", "collection", "tag", "author", "table"]),
        id: z.union([z.number(), z.string()]),
        name: z.string().optional(),
    })).describe("Items to add/remove"),
});

const tableIdParams = z.object({
    table_id: z.string().optional().describe("Table ID"),
    include_data: z.boolean().default(false).optional().describe("Include row data"),
});

const createTableParams = z.object({
    name: z.string().describe("Table name"),
    item_ids: z.array(z.number()).optional().describe("Initial paper IDs"),
});

const addToTableParams = z.object({
    table_id: z.string().describe("Table ID"),
    item_ids: z.array(z.number()).describe("Paper IDs to add"),
});

const createTableColumnParams = z.object({
    table_id: z.string().describe("Table ID"),
    column_name: z.string().describe("Column name"),
    ai_prompt: z.string().describe("AI prompt for generating data"),
});

const generateTableDataParams = z.object({
    table_id: z.string().describe("Table ID"),
    column_id: z.string().optional().describe("Specific column ID"),
    item_ids: z.array(z.number()).optional().describe("Specific paper IDs"),
});

const searchExternalParams = z.object({
    query: z.string().describe("Search query"),
    year: z.string().optional().describe("Year range (e.g., '2020-2024')"),
    limit: z.number().min(1).max(100).default(10).optional().describe("Max results"),
    openAccessPdf: z.boolean().default(false).optional().describe("Only open access PDFs"),
});

const importPaperParams = z.object({
    paper_id: z.string().describe("Semantic Scholar paper ID"),
    target_collection_id: z.number().optional().describe("Target collection ID"),
    trigger_ocr: z.boolean().default(false).optional().describe("Trigger OCR after import"),
});

const moveItemParams = z.object({
    item_id: z.number().describe("Item ID to move"),
    target_collection_id: z.number().describe("Target collection ID"),
    remove_from_others: z.boolean().default(false).optional().describe("Remove from other collections"),
});

const removeItemFromCollectionParams = z.object({
    item_id: z.number().describe("Item ID"),
    collection_id: z.number().describe("Collection ID"),
});

const findCollectionParams = z.object({
    name: z.string().describe("Collection name to search"),
    library_id: z.number().optional().describe("Library ID"),
    parent_collection_id: z.number().optional().describe("Parent collection ID"),
});

const createCollectionParams = z.object({
    name: z.string().describe("Collection name"),
    parent_collection_id: z.number().optional().describe("Parent collection ID"),
    library_id: z.number().optional().describe("Library ID"),
});

const listCollectionParams = z.object({
    collection_id: z.number().describe("Collection ID"),
});

// Tool definitions
export const TOOL_DEFINITIONS = [
    {
        name: "search_library",
        description: "Search the Zotero library for papers matching a query. Returns titles, authors, and IDs.",
        inputSchema: searchLibraryParams,
    },
    {
        name: "get_item_metadata",
        description: "Get complete metadata for a Zotero item (authors, DOI, abstract, etc.).",
        inputSchema: getItemMetadataParams,
    },
    {
        name: "read_item_content",
        description: "Read the full content of a paper including notes and PDF text.",
        inputSchema: readItemContentParams,
    },
    {
        name: "create_note",
        description: "Create a new note in Zotero, optionally attached to a paper.",
        inputSchema: createNoteParams,
    },
    {
        name: "add_to_context",
        description: "Add papers, collections, or tables to the conversation context.",
        inputSchema: contextItemParams,
    },
    {
        name: "remove_from_context",
        description: "Remove items from the conversation context.",
        inputSchema: contextItemParams,
    },
    {
        name: "list_context",
        description: "List all items currently in the conversation context.",
        inputSchema: z.object({}),
    },
    {
        name: "list_tables",
        description: "List all analysis tables in Zotero.",
        inputSchema: z.object({}),
    },
    {
        name: "create_table",
        description: "Create a new analysis table for comparing papers.",
        inputSchema: createTableParams,
    },
    {
        name: "add_to_table",
        description: "Add papers to an existing table.",
        inputSchema: addToTableParams,
    },
    {
        name: "create_table_column",
        description: "Add an AI-generated column to a table.",
        inputSchema: createTableColumnParams,
    },
    {
        name: "generate_table_data",
        description: "Generate AI data for table columns.",
        inputSchema: generateTableDataParams,
    },
    {
        name: "read_table",
        description: "Read the contents of a table.",
        inputSchema: tableIdParams,
    },
    {
        name: "search_external",
        description: "Search Semantic Scholar for external papers.",
        inputSchema: searchExternalParams,
    },
    {
        name: "import_paper",
        description: "Import a paper from Semantic Scholar into Zotero.",
        inputSchema: importPaperParams,
    },
    {
        name: "move_item",
        description: "Move a paper to a collection.",
        inputSchema: moveItemParams,
    },
    {
        name: "remove_item_from_collection",
        description: "Remove a paper from a collection (paper stays in library).",
        inputSchema: removeItemFromCollectionParams,
    },
    {
        name: "find_collection",
        description: "Find a collection by name.",
        inputSchema: findCollectionParams,
    },
    {
        name: "create_collection",
        description: "Create a new collection in Zotero.",
        inputSchema: createCollectionParams,
    },
    {
        name: "list_collection",
        description: "List all items in a collection.",
        inputSchema: listCollectionParams,
    },
    {
        name: "search_web",
        description: "Search the general web for information. Use this for finding documentation, blogs, GitHub repositories, or non-academic information.",
        inputSchema: z.object({
            query: z.string().describe("Search query"),
            limit: z.number().default(5).optional().describe("Max results (default 5)")
        }),
    },
    {
        name: "read_webpage",
        description: "Read the content of any webpage URL as clean markdown. Use this to read blogs, documentation, or news articles found via search_web.",
        inputSchema: z.object({
            url: z.string().describe("The URL to read")
        }),
    },
    {
        name: "get_citations",
        description: "Find papers that cite a specific paper (Forward Citations). Use this to find newer research that builds upon a key paper.",
        inputSchema: z.object({
            paper_id: z.string().describe("Semantic Scholar Paper ID"),
            limit: z.number().default(10).optional().describe("Max results (default 10)")
        }),
    },
    {
        name: "get_references",
        description: "Find papers cited by a specific paper (Backward References). Use this to understand the foundational work that a paper is based on.",
        inputSchema: z.object({
            paper_id: z.string().describe("Semantic Scholar Paper ID"),
            limit: z.number().default(10).optional().describe("Max results (default 10)")
        }),
    },
];

export type ToolName = typeof TOOL_DEFINITIONS[number]["name"];
