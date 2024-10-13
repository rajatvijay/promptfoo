import type { Cache } from 'cache-manager';
import fetch from 'node-fetch';
import Replicate from 'replicate';
import invariant from 'tiny-invariant';
import { getCache, isCacheEnabled } from '../cache';
import { getEnvString } from '../envars';
import logger from '../logger';
import type {
  ApiModerationProvider,
  ApiProvider,
  CallApiContextParams,
  CallApiOptionsParams,
  EnvOverrides,
  ModerationFlag,
  ProviderModerationResponse,
  ProviderResponse,
} from '../types';
import { safeJsonStringify } from '../util/json';
import { parseChatPrompt } from './shared';

interface ReplicateCompletionOptions {
  apiKey?: string;
  temperature?: number;
  max_length?: number;
  max_new_tokens?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  repetition_penalty?: number;
  system_prompt?: string;
  stop_sequences?: string;
  seed?: number;

  prompt?: {
    prefix?: string;
    suffix?: string;
  };

  // Any other key-value pairs will be passed to the Replicate API as-is
  [key: string]: any;
}

export class ReplicateProvider implements ApiProvider {
  modelName: string;
  apiKey: string;
  replicate: Replicate;
  config: ReplicateCompletionOptions;

  constructor(
    modelName: string,
    options: { config?: ReplicateCompletionOptions; id?: string; env?: EnvOverrides } = {},
  ) {
    const { config, id, env } = options;
    this.modelName = modelName;
    const apiKey =
      config?.apiKey ||
      env?.REPLICATE_API_KEY ||
      env?.REPLICATE_API_TOKEN ||
      getEnvString('REPLICATE_API_TOKEN') ||
      getEnvString('REPLICATE_API_KEY');
    invariant(apiKey, 'Replicate API key is not set');
    this.apiKey = apiKey;
    this.config = config || {};
    this.id = id ? () => id : this.id;
    this.replicate = new Replicate({
      auth: this.apiKey,
      // Add a custom fetch function to include the Prefer header
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        headers.set('Prefer', 'wait=60');
        return globalThis.fetch(input, { ...init, headers });
      },
    });
  }

  id(): string {
    return `replicate:${this.modelName}`;
  }

  toString(): string {
    return `[Replicate Provider ${this.modelName}]`;
  }

  async callApi(
    prompt: string,
    context?: CallApiContextParams,
    options?: CallApiOptionsParams,
  ): Promise<ProviderResponse> {
    if (!this.apiKey) {
      throw new Error(
        'Replicate API key is not set. Set the REPLICATE_API_TOKEN environment variable or or add `apiKey` to the provider config.',
      );
    }

    if (this.config.prompt?.prefix) {
      prompt = this.config.prompt.prefix + prompt;
    }
    if (this.config.prompt?.suffix) {
      prompt = prompt + this.config.prompt.suffix;
    }

    let cache;
    let cacheKey;
    if (isCacheEnabled()) {
      cache = await getCache();
      cacheKey = `replicate:${this.modelName}:${JSON.stringify(this.config)}:${prompt}`;

      // Try to get the cached response
      const cachedResponse = await cache.get(cacheKey);

      if (cachedResponse) {
        logger.debug(`Returning cached response for ${prompt}: ${cachedResponse}`);
        return JSON.parse(cachedResponse as string);
      }
    }

    const messages = parseChatPrompt(prompt, [{ role: 'user', content: prompt }]);
    const systemPrompt =
      messages.find((message) => message.role === 'system')?.content ||
      this.config.system_prompt ||
      getEnvString('REPLICATE_SYSTEM_PROMPT');
    const userPrompt = messages.find((message) => message.role === 'user')?.content || prompt;

    logger.debug(`Calling Replicate: ${prompt}`);
    try {
      const output = await this.replicate.run(this.modelName as `${string}/${string}`, {
        input: { prompt, ...this.config },
      });

      // Handle the synchronous response
      if (Array.isArray(output) && output.length > 0) {
        return {
          output: output.join(''),
          tokenUsage: {}, // Replicate doesn't provide token usage info
        };
      } else if (typeof output === 'string') {
        return {
          output,
          tokenUsage: {},
        };
      } else {
        return {
          output: JSON.stringify(output),
          tokenUsage: {},
        };
      }
    } catch (err) {
      return {
        error: `API call error: ${String(err)}`,
      };
    }
  }
}

const LLAMAGUARD_DESCRIPTIONS: { [key: string]: string } = {
  S1: 'Violent Crimes',
  S2: 'Non-Violent Crimes',
  S3: 'Sex-Related Crimes',
  S4: 'Child Sexual Exploitation',
  S5: 'Specialized Advice',
  S6: 'Privacy',
  S7: 'Intellectual Property',
  S8: 'Indiscriminate Weapons',
  S9: 'Hate',
  S10: 'Suicide & Self-Harm',
  S11: 'Sexual Content',
};

export class ReplicateModerationProvider
  extends ReplicateProvider
  implements ApiModerationProvider
{
  async callModerationApi(prompt: string, assistant: string): Promise<ProviderModerationResponse> {
    if (!this.apiKey) {
      throw new Error(
        'Replicate API key is not set. Set the REPLICATE_API_TOKEN environment variable or or add `apiKey` to the provider config.',
      );
    }

    let cache: Cache | undefined;
    let cacheKey: string | undefined;
    if (isCacheEnabled()) {
      cache = await getCache();
      cacheKey = `replicate:${this.modelName}:${JSON.stringify(
        this.config,
      )}:${prompt}:${assistant}`;

      // Try to get the cached response
      const cachedResponse = await cache.get(cacheKey);

      if (cachedResponse) {
        logger.debug(`Returning cached response for ${prompt}: ${cachedResponse}`);
        return JSON.parse(cachedResponse as string);
      }
    }

    const replicate = new Replicate({
      auth: this.apiKey,
      fetch: fetch as any,
    });

    logger.debug(`Calling Replicate moderation API: prompt [${prompt}] assistant [${assistant}]`);
    let output: string | undefined;
    try {
      const data = {
        input: {
          prompt,
          assistant,
        },
      };
      const resp = await replicate.run(this.modelName as any, data);
      // Replicate SDK seems to be mis-typed for this type of model.
      output = resp as unknown as string;
    } catch (err) {
      return {
        error: `API call error: ${String(err)}`,
      };
    }
    logger.debug(`\tReplicate moderation API response: ${JSON.stringify(output)}`);
    try {
      if (!output) {
        throw new Error('API response error: no output');
      }
      const [safeString, codes] = output.split('\n');
      const saveCache = async () => {
        if (cache && cacheKey) {
          await cache.set(cacheKey, JSON.stringify(output));
        }
      };

      const flags: ModerationFlag[] = [];
      if (safeString === 'safe') {
        await saveCache();
      } else {
        const splits = codes.split(',');
        for (const code of splits) {
          if (LLAMAGUARD_DESCRIPTIONS[code]) {
            flags.push({
              code,
              description: `${LLAMAGUARD_DESCRIPTIONS[code]} (${code})`,
              confidence: 1,
            });
          }
        }
      }
      return { flags };
    } catch (err) {
      return {
        error: `API response error: ${String(err)}: ${JSON.stringify(output)}`,
      };
    }
  }
}

export const DefaultModerationProvider = new ReplicateModerationProvider(
  'meta/meta-llama-guard-2-8b:b063023ee937f28e922982abdbf97b041ffe34ad3b35a53d33e1d74bb19b36c4',
);

interface ReplicateImageOptions {
  width?: number;
  height?: number;
  refine?: string;
  apply_watermark?: boolean;
  num_inference_steps?: number;
}

export class ReplicateImageProvider extends ReplicateProvider {
  config: ReplicateImageOptions;

  constructor(
    modelName: string,
    options: { config?: ReplicateImageOptions; id?: string; env?: EnvOverrides } = {},
  ) {
    super(modelName, options);
    this.config = options.config || {};
  }

  async callApi(
    prompt: string,
    context?: CallApiContextParams,
    callApiOptions?: CallApiOptionsParams,
  ): Promise<ProviderResponse> {
    const cache = getCache();
    const cacheKey = `replicate:image:${safeJsonStringify({ context, prompt })}`;

    if (!this.apiKey) {
      throw new Error(
        'Replicate API key is not set. Set the REPLICATE_API_TOKEN environment variable or add `apiKey` to the provider config.',
      );
    }

    const replicate = new Replicate({
      auth: this.apiKey,
    });

    let response: any | undefined;
    let cached = false;
    if (isCacheEnabled()) {
      const cachedResponse = await cache.get(cacheKey);
      if (cachedResponse) {
        logger.debug(`Retrieved cached response for ${prompt}: ${cachedResponse}`);
        response = JSON.parse(cachedResponse as string);
        cached = true;
      }
    }

    if (!response) {
      const data = {
        input: {
          width: this.config.width || 768,
          height: this.config.height || 768,
          prompt,
        },
      };
      response = await replicate.run(this.modelName as any, data);
    }

    const url = response[0];
    if (!url) {
      return {
        error: `No image URL found in response: ${JSON.stringify(response)}`,
      };
    }

    if (!cached && isCacheEnabled()) {
      try {
        await cache.set(cacheKey, JSON.stringify(response));
      } catch (err) {
        logger.error(`Failed to cache response: ${String(err)}`);
      }
    }

    const sanitizedPrompt = prompt
      .replace(/\r?\n|\r/g, ' ')
      .replace(/\[/g, '(')
      .replace(/\]/g, ')');
    const ellipsizedPrompt =
      sanitizedPrompt.length > 50 ? `${sanitizedPrompt.substring(0, 47)}...` : sanitizedPrompt;
    return {
      output: `![${ellipsizedPrompt}](${url})`,
      cached,
    };
  }
}
