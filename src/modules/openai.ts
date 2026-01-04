import { config } from "../../package.json";

// Standard text message
export interface OpenAIMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

// Vision message content parts for multimodal
export interface VisionMessageContentPart {
    type: "text" | "image_url";
    text?: string;
    image_url?: {
        url: string;  // Can be URL or base64: "data:image/jpeg;base64,{base64_image}"
        detail?: "auto" | "low" | "high";  // Vision detail level
    };
}

// Vision-enabled message (for GPT-4 Vision, Claude 3, etc.)
export interface VisionMessage {
    role: "system" | "user" | "assistant";
    content: string | VisionMessageContentPart[];
}

// Union type for any message
export type AnyOpenAIMessage = OpenAIMessage | VisionMessage | ToolCallMessage | ToolResultMessage;

// Tool definition in OpenAI format
export interface ToolDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: object;
    };
}

// Tool call from API response
export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

// Message with tool calls (assistant response)
export interface ToolCallMessage {
    role: "assistant";
    content: string | null;
    tool_calls: ToolCall[];
}

// Message with tool result (to send back)
export interface ToolResultMessage {
    role: "tool";
    tool_call_id: string;
    content: string;
}

export interface StreamCallbacks {
    onToken?: (token: string) => void;
    onComplete?: (fullContent: string) => void;
    onError?: (error: Error) => void;
    /** Called when tool calls are detected in the response */
    onToolCalls?: (toolCalls: ToolCall[]) => void;
}


export class OpenAIService {
    // Active AbortController for current request (may not be available in Zotero)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private currentController: any = null;
    private isAborted: boolean = false;

    private getPrefs() {
        Zotero.debug(`[seerai] Config Prefix: ${config.prefsPrefix}`);
        Zotero.debug(`[seerai] Reading Key: ${config.prefsPrefix}.apiKey`);
        const val = Zotero.Prefs.get(`${config.prefsPrefix}.apiKey`);
        Zotero.debug(`[seerai] API Key Value: ${val}`);

        return {
            apiURL: Zotero.Prefs.get(`${config.prefsPrefix}.apiURL`) as string,
            apiKey: Zotero.Prefs.get(`${config.prefsPrefix}.apiKey`) as string,
            model: Zotero.Prefs.get(`${config.prefsPrefix}.model`) as string,
        };
    }

    /**
     * Check if there's an active request that can be aborted
     */
    isRequestActive(): boolean {
        return this.currentController !== null;
    }

    /**
     * Check if the current request has been aborted
     */
    isAbortedState(): boolean {
        return this.isAborted;
    }

    /**
     * Abort the current request if one is active
     */
    abortRequest(): boolean {
        this.isAborted = true;
        if (this.currentController) {
            try {
                this.currentController.abort();
            } catch (e) {
                // AbortController.abort() may not be available
            }
            this.currentController = null;
            Zotero.debug("[seerai] Request aborted by user");
            return true;
        }
        return false;
    }

    /**
     * Clear the abort state for a new request
     */
    resetAbortState(): void {
        this.isAborted = false;
        this.currentController = null;
    }

    /**
     * Standard chat completion (non-streaming)
     */
    async chatCompletion(messages: OpenAIMessage[]): Promise<string> {
        const { apiURL, apiKey, model } = this.getPrefs();

        if (!apiKey) {
            throw new Error("OpenAI API Key is missing. Please set it in preferences.");
        }

        const endpoint = apiURL.endsWith("/") ? `${apiURL}chat/completions` : `${apiURL}/chat/completions`;

        // Create new AbortController for this request (if available)
        this.isAborted = false;
        let signal: AbortSignal | undefined;
        try {
            // AbortController may not be available in Zotero's environment
            if (typeof AbortController !== 'undefined') {
                this.currentController = new AbortController();
                signal = this.currentController.signal;
            }
        } catch (e) {
            // Fallback: no abort support
            Zotero.debug("[seerai] AbortController not available, abort disabled");
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages,
                }),
                ...(signal ? { signal } : {}),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API Error: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json() as any;
            return data.choices?.[0]?.message?.content || "";
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                throw new Error("Request was cancelled");
            }
            Zotero.logError(error as Error);
            throw error;
        } finally {
            this.currentController = null;
        }
    }

    /**
     * Streaming chat completion with token-by-token callbacks
     * @param configOverride Optional config to use instead of preferences (for multi-model support)
     * @param tools Optional tool definitions for function calling
     */
    async chatCompletionStream(
        messages: AnyOpenAIMessage[],
        callbacks: StreamCallbacks,
        configOverride?: { apiURL?: string; apiKey?: string; model?: string },
        tools?: ToolDefinition[]
    ): Promise<void> {
        const prefs = this.getPrefs();
        const apiURL = configOverride?.apiURL || prefs.apiURL;
        const apiKey = configOverride?.apiKey || prefs.apiKey;
        const model = configOverride?.model || prefs.model;

        if (!apiKey) {
            throw new Error("OpenAI API Key is missing. Please set it in preferences.");
        }

        const endpoint = apiURL.endsWith("/") ? `${apiURL}chat/completions` : `${apiURL}/chat/completions`;

        // Create new AbortController for this request (if available)
        this.isAborted = false;
        let signal: AbortSignal | undefined;
        try {
            if (typeof AbortController !== 'undefined') {
                this.currentController = new AbortController();
                signal = this.currentController.signal;
            }
        } catch (e) {
            Zotero.debug("[seerai] AbortController not available, abort disabled");
        }

        let fullContent = "";

        // Track tool calls being assembled from streaming chunks
        const toolCallsInProgress: Map<number, {
            id: string;
            type: "function";
            function: { name: string; arguments: string };
        }> = new Map();

        try {
            // Build request body
            const requestBody: Record<string, unknown> = {
                model,
                messages,
                stream: true,
            };

            // Add tools if provided
            if (tools && tools.length > 0) {
                requestBody.tools = tools;
                // Allow the model to choose whether to call tools
                requestBody.tool_choice = "auto";
            }

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify(requestBody),
                ...(signal ? { signal } : {}),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API Error: ${response.statusText} - ${errorText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("Failed to get response reader");
            }

            const decoder = new TextDecoder();

            while (true) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await (reader as any).read();
                const { done, value } = result;

                if (done) break;

                // Check if manually aborted (fallback for environments without AbortController)
                if (this.isAborted) {
                    callbacks.onComplete?.(fullContent);
                    Zotero.debug("[seerai] Stream manually aborted");
                    throw new Error("Request was cancelled");
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            continue;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta;

                            // Handle regular content tokens
                            if (delta?.content) {
                                fullContent += delta.content;
                                callbacks.onToken?.(delta.content);
                            }

                            // Handle tool calls (streamed incrementally)
                            if (delta?.tool_calls) {
                                for (const toolCallDelta of delta.tool_calls) {
                                    const index = toolCallDelta.index ?? 0;

                                    // Initialize tool call if this is the first chunk for this index
                                    if (!toolCallsInProgress.has(index)) {
                                        toolCallsInProgress.set(index, {
                                            id: toolCallDelta.id || "",
                                            type: "function",
                                            function: {
                                                name: toolCallDelta.function?.name || "",
                                                arguments: ""
                                            }
                                        });
                                    }

                                    const toolCall = toolCallsInProgress.get(index)!;

                                    // Update with new data
                                    if (toolCallDelta.id) {
                                        toolCall.id = toolCallDelta.id;
                                    }
                                    if (toolCallDelta.function?.name) {
                                        toolCall.function.name = toolCallDelta.function.name;
                                    }
                                    if (toolCallDelta.function?.arguments) {
                                        toolCall.function.arguments += toolCallDelta.function.arguments;
                                    }
                                }
                            }
                        } catch (e) {
                            // Skip malformed JSON chunks
                        }
                    }
                }
            }

            // After stream ends, check if we have tool calls to dispatch
            if (toolCallsInProgress.size > 0) {
                const toolCalls: ToolCall[] = Array.from(toolCallsInProgress.values());
                Zotero.debug(`[seerai] Stream completed with ${toolCalls.length} tool call(s)`);

                // Invoke tool calls callback
                if (callbacks.onToolCalls) {
                    callbacks.onToolCalls(toolCalls);
                }
            }

            callbacks.onComplete?.(fullContent);
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                // Call onComplete with partial content when aborted
                callbacks.onComplete?.(fullContent);
                Zotero.debug("[seerai] Stream aborted by user");
                throw new Error("Request was cancelled");
            }
            callbacks.onError?.(error as Error);
            Zotero.logError(error as Error);
            throw error;
        } finally {
            this.currentController = null;
        }
    }


    async testConnection(): Promise<boolean> {
        try {
            await this.chatCompletion([{ role: "user", content: "Hello" }]);
            return true;
        } catch (e) {
            return false;
        }
    }
}

export const openAIService = new OpenAIService();
