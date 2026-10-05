import { admin } from './http.ts';
export async function recordMetric(
  userId: string | undefined,
  operation: 'audio' | 'vision' | 'extraction' | 'notification',
  started: number,
  success: boolean,
  model: string | null = null,
  usage: { input_tokens?: number; output_tokens?: number; audio_seconds?: number } = {},
) {
  if (!userId) return;
  try {
    const db = admin();
    const profile = await db.from('profiles').select('metrics_enabled').eq('id', userId).single();
    if (profile.error || !profile.data.metrics_enabled) return;
    await db
      .from('operation_metrics')
      .insert({
        user_id: userId,
        operation,
        model,
        latency_ms: Math.max(0, Date.now() - started),
        success,
        input_tokens: usage.input_tokens ?? null,
        output_tokens: usage.output_tokens ?? null,
        audio_seconds: usage.audio_seconds ?? null,
      });
  } catch {
    return;
  }
}
