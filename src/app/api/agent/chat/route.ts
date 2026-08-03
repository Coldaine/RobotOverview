import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import {
  createBeastAgentModel,
  isHangarAgentEnabled,
  readAgentModelConfig,
} from '@/server/beast/model';
import { BEAST_AGENT_SYSTEM_PROMPT } from '@/server/beast/prompts';
import { getBeastRosClient } from '@/server/beast/ros-singleton';
import { createAgentTools } from '@/server/beast/tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isHangarAgentEnabled()) {
    return Response.json(
      {
        ok: false,
        error: 'Hangar agent path disabled',
        hint: 'Set HANGAR_AGENT_ENABLED=true to enable /api/agent/chat',
      },
      { status: 503 },
    );
  }

  const modelConfig = readAgentModelConfig();
  if (!modelConfig) {
    return Response.json(
      {
        ok: false,
        error: 'Agent planner not configured',
        hint: 'Set BEAST_AGENT_BASE_URL and BEAST_AGENT_MODEL (OpenAI-compatible / Ollama)',
      },
      { status: 503 },
    );
  }

  let messages: UIMessage[];
  try {
    const body = (await req.json()) as { messages?: UIMessage[] };
    if (!Array.isArray(body.messages)) {
      return Response.json({ ok: false, error: 'messages array required' }, { status: 400 });
    }
    messages = body.messages;
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const bridge = getBeastRosClient();
  // Kick a connect attempt when the bridge URL exists; no-op when unset.
  void bridge.start();

  const tools = createAgentTools(bridge);
  const model = createBeastAgentModel(modelConfig);

  const result = streamText({
    model,
    system: BEAST_AGENT_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(6),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
