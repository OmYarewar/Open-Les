
from openai import AsyncOpenAI
import json
from .config import config
from .memory import memory, Message
from .tools import TOOLS_SCHEMA, execute_tool_call, AVAILABLE_TOOLS
from .mcp_manager import mcp_manager

class Agent:
    def __init__(self):
        # We now cache clients per config_id to support multiple configurations
        self.clients = {}

    def _get_client(self, config_id: str):
        # Get the configuration object
        api_config = config.get_config_by_id(config_id)
        if not api_config:
            # Fallback to active config if specific config is not found
            api_config = config.get_active_config()

        if not api_config:
            # If still no config, we can't initialize
            return None, None

        # Initialize or fetch cached client for this specific API configuration
        # Use api_key and base_url to cache since they determine the connection
        cache_key = f"{api_config.api_key}:{api_config.base_url}"

        if cache_key not in self.clients:
            self.clients[cache_key] = AsyncOpenAI(
                api_key=api_config.api_key or "dummy-key",
                base_url=api_config.base_url
            )

        return self.clients[cache_key], api_config.model

    async def chat(self, session_id: str, user_message: str):
        # Add user message to memory
        memory.add_message(session_id, Message(role="user", content=user_message))

        # Get session to determine which config to use
        session = memory.get_session(session_id)

        # Determine config ID. If session doesn't have one, use active_config_id
        config_id_to_use = session.config_id
        if not config_id_to_use and config.active_config_id:
            config_id_to_use = config.active_config_id
            session.config_id = config_id_to_use
            memory.save_session(session_id)

        # Ensure is_cancelled is false when starting
        session.is_cancelled = False
        memory.save_session(session_id)

        client, model = self._get_client(config_id_to_use)

        if not client:
            error_msg = "Error: No API configuration found. Please add an API Key in Settings."
            memory.add_message(session_id, Message(role="assistant", content=error_msg))
            yield {"role": "assistant", "content": error_msg}
            return

        while True:
            # Check for cancellation before calling API
            if memory.get_session(session_id).is_cancelled:
                yield {"role": "assistant", "content": "\n\n*[Execution stopped by user]*"}
                break

            # Prepare messages payload
            messages = [{"role": "system", "content": config.system_prompt}]
            messages.extend(memory.get_history(session_id))

            # Combine static tools and MCP dynamic tools
            current_tools_schema = TOOLS_SCHEMA.copy()
            current_tools_schema.extend(mcp_manager.get_tool_schemas())

            try:
                # Call LLM
                response = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=current_tools_schema,
                    tool_choice="auto"
                )
            except Exception as e:
                error_msg = f"API Error: {str(e)}"
                memory.add_message(session_id, Message(role="assistant", content=error_msg))
                yield {"role": "assistant", "content": error_msg}
                break

            # Check for cancellation after API returns
            if memory.get_session(session_id).is_cancelled:
                yield {"role": "assistant", "content": "\n\n*[Execution stopped by user]*"}
                break

            response_message = response.choices[0].message
            
            # Save assistant message
            assistant_msg = Message(
                role="assistant",
                content=response_message.content or "",
            )
            if response_message.tool_calls:
                assistant_msg.tool_calls = [
                    {
                        "id": t.id,
                        "type": "function",
                        "function": {
                            "name": t.function.name,
                            "arguments": t.function.arguments
                        }
                    }
                    for t in response_message.tool_calls
                ]
            memory.add_message(session_id, assistant_msg)

            # Yield partial response (useful for streaming/UI updates)
            yield assistant_msg.model_dump(exclude_none=True)

            # Handle tool calls
            if response_message.tool_calls:
                for tool_call in response_message.tool_calls:
                    # Check for cancellation before executing each tool
                    if memory.get_session(session_id).is_cancelled:
                        break

                    func_name = tool_call.function.name
                    arguments_str = tool_call.function.arguments

                    tool_result = None
                    import asyncio

                    async def execute_tool():
                        if func_name in AVAILABLE_TOOLS:
                            return await asyncio.to_thread(execute_tool_call, {
                                "function": {
                                    "name": func_name,
                                    "arguments": arguments_str
                                }
                            })
                        else:
                            try:
                                args = json.loads(arguments_str)
                                return await mcp_manager.call_tool(func_name, args)
                            except Exception as e:
                                return f"Error evaluating MCP tool {func_name}: {e}"

                    # Run tool with ability to poll for cancellation
                    tool_task = asyncio.create_task(execute_tool())

                    # Poll for cancellation
                    while not tool_task.done():
                        if memory.get_session(session_id).is_cancelled:
                            tool_task.cancel()
                            try:
                                await tool_task
                            except asyncio.CancelledError:
                                pass
                            tool_result = "Tool execution cancelled by user."
                            break
                        await asyncio.sleep(0.1)

                    if not memory.get_session(session_id).is_cancelled:
                        tool_result = tool_task.result()
                    
                    tool_msg = Message(
                        role="tool",
                        content=str(tool_result),
                        tool_call_id=tool_call.id,
                        name=func_name
                    )
                    memory.add_message(session_id, tool_msg)
                    yield tool_msg.model_dump(exclude_none=True)

                    # If we cancelled the task during execution
                    if memory.get_session(session_id).is_cancelled:
                        break

                # If we broke out of tool loop due to cancellation
                if memory.get_session(session_id).is_cancelled:
                    yield {"role": "assistant", "content": "\n\n*[Tool execution stopped by user]*"}
                    break
            else:
                # No more tool calls, exit loop
                break

agent = Agent()
