# GitHub Models

GitHub offers access to various AI models through their inference API. These models can be used with promptfoo by configuring the underlying provider with custom settings. GitHub's API acts as a proxy to multiple model providers, allowing you to access a wide range of models through a single interface.

## Setup

1. Generate a GitHub Personal Access Token (PAT) with no specific permissions.
2. Set the `GITHUB_TOKEN` environment variable:

```sh
export GITHUB_TOKEN="your-github-pat-here"
```

## Configuration

To use GitHub models, configure the provider with custom `apiKey` and `apiBaseUrl` settings. The configuration depends on the model provider you're using.

For OpenAI models:

```yaml
providers:
  - id: openai:chat:gpt-4o-mini
    config:
      apiKey: ${GITHUB_TOKEN}
      apiBaseUrl: https://models.inference.ai.azure.com
```

For Mistral models:

```yaml
providers:
  - id: mistral:Mistral-Nemo
    config:
      apiKey: ${GITHUB_TOKEN}
      apiBaseUrl: https://models.inference.ai.azure.com
```

## Available Models

GitHub offers a wide range of models from various providers, including:

### OpenAI Models

- `gpt-4o`, `gpt-4o-mini`: Advanced multi-modal models
- `o1-preview`, `o1-mini`: Models focused on reasoning and code generation
- `Text Embedding 3 (large)`, `Text Embedding 3 (small)`: Latest embedding models

### Microsoft Models

- Various Phi-3 and Phi-3.5 models with different sizes and capabilities

### AI21 Labs Models

- `AI21 Jamba 1.5 Large`, `AI21 Jamba 1.5 Mini`: Multilingual models with long context windows

### Cohere Models

- `Cohere Command R`, `Cohere Command R+`: Models optimized for RAG and enterprise use
- `Cohere Embed v3 English`, `Cohere Embed v3 Multilingual`: Text representation models

### Meta Models

- Various Llama 3 and Llama 3.1 models, including vision-capable versions

### Mistral AI Models

- `Mistral Nemo`, `Mistral Large`, `Mistral Small`: Models with varying capabilities and sizes

For a complete and up-to-date list of available models, refer to the [GitHub Models documentation](https://docs.github.com/en/github-models/prototyping-with-ai-models).

## Usage Example

Here's an example of how to use the GitHub `gpt-4o-mini` model in your promptfoo configuration:

```yaml
prompts:
  - "Summarize the following text: {{text}}"

providers:
  - id: openai:chat:gpt-4o-mini
    config:
      apiKey: ${GITHUB_TOKEN}
      apiBaseUrl: https://models.inference.ai.azure.com

tests:
  - vars:
      text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit..."
```

By using GitHub's model inference API, you can easily switch between different models and providers while maintaining a consistent interface in your promptfoo configurations.