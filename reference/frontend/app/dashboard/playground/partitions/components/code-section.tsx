import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import SyntaxHighlighter from "@/app/components/syntax-highlighter";
import { oneLight } from "@/app/shared/syntax-highlighter-styles";
import { toast } from "sonner";
import { Copy, Terminal, Key, Loader2, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import PythonLogo from "@/public/logos/python_logo_2.svg";
import TypeScriptLogo from "@/public/logos/typescript_logo.svg";
import { fetchWithAuth } from "@/backend/client-auth-utils";
import { useCanOrganization } from "@/app/dashboard/shared/authz/authorization-checks";
import type { PartitionConfig } from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/partition-playground";
import {
  goStringLiteral,
  javaMainSnippet,
  javaStringLiteral,
  phpStringLiteral,
  rustStringLiteral,
} from "@/app/dashboard/playground/components/snippet-literals";
import { SnippetLanguageIcon } from "@/app/dashboard/playground/components/snippet-language-icon";

interface NewAPIKey {
  key: string;
  name: string;
  created_at: string;
  organization_id: string;
}

const DEFAULT_KEY = "invoice_number";
const DEFAULT_INSTRUCTIONS =
  "Group the pages by invoice number. Return one entry per distinct invoice.";

export const generateRetabPartitionCode = (
  cfg: PartitionConfig,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const key = cfg.key?.trim() || DEFAULT_KEY;
  const instructions = cfg.instructions?.trim() || DEFAULT_INSTRUCTIONS;
  const model = cfg.model || "retab-small";
  const nConsensus = cfg.n_consensus ?? 1;
  const allowOverlap = cfg.allow_overlap === true;

  return `# ---------------------------------------------
# Variables from your configuration
# ---------------------------------------------
api_key = "${apiKey}"
document = "path/to/your/file"
key = "${key}"
instructions = """${instructions}"""
model = "${model}"
n_consensus = ${nConsensus}
allow_overlap = ${allowOverlap ? "True" : "False"}

# ---------------------------------------------
# ---------------------------------------------

from retab import Retab

client = Retab(api_key=api_key)
partition_result = client.partitions.create(
    document=document,
    key=key,
    instructions=instructions,
    model=model,
    n_consensus=n_consensus,
    allow_overlap=allow_overlap,
)

print("Document partition results:")
for chunk in partition_result.output:
    print(f"  {chunk.key}: pages {', '.join(map(str, chunk.pages))}")

print(f"\\nTotal chunks: {len(partition_result.output)}")
`;
};

export const generateTypeScriptCode = (
  cfg: PartitionConfig,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const key = cfg.key?.trim() || DEFAULT_KEY;
  const instructions = cfg.instructions?.trim() || DEFAULT_INSTRUCTIONS;
  const model = cfg.model || "retab-small";
  const nConsensus = cfg.n_consensus ?? 1;
  const allowOverlap = cfg.allow_overlap === true;

  return `import { Retab } from '@retab/node';

const apiKey = "${apiKey}";

const client = new Retab({ apiKey });

const result = await client.partitions.create(
    "path/to/your/file",
    "${key}",
    ${JSON.stringify(instructions)},
    "${model}",
    ${nConsensus},
    ${allowOverlap}
);

console.log("Document partition results:");
result.output.forEach((chunk) => {
    console.log(\`  \${chunk.key}: pages \${chunk.pages.join(', ')}\`);
});

console.log(\`\\nTotal chunks: \${result.output.length}\`);
`;
};

export const generateGoCode = (
  cfg: PartitionConfig,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const key = cfg.key?.trim() || DEFAULT_KEY;
  const instructions = cfg.instructions?.trim() || DEFAULT_INSTRUCTIONS;
  const model = cfg.model || "retab-small";
  const nConsensus = cfg.n_consensus ?? 1;
  const allowOverlap = cfg.allow_overlap === true;

  return `import (
    "context"
    "fmt"

    retab "github.com/retab-dev/retab/clients/go"
)

ctx := context.Background()
client, err := retab.NewClient(${goStringLiteral(apiKey)})
if err != nil {
    panic(err)
}

model := ${goStringLiteral(model)}
nConsensus := ${nConsensus}
allowOverlap := ${allowOverlap}
result, err := client.Partitions.Create(ctx, &retab.PartitionsCreateParams{
    Document: "path/to/your/file",
    Key: ${goStringLiteral(key)},
    Instructions: ${goStringLiteral(instructions)},
    Model: &model,
    NConsensus: &nConsensus,
    AllowOverlap: &allowOverlap,
})
if err != nil {
    panic(err)
}

fmt.Println("Document partition results:")
for _, chunk := range result.Output {
    fmt.Printf("  %s: pages %v\\n", chunk.Key, chunk.Pages)
}
`;
};

export const generatePhpCode = (
  cfg: PartitionConfig,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const key = cfg.key?.trim() || DEFAULT_KEY;
  const instructions = cfg.instructions?.trim() || DEFAULT_INSTRUCTIONS;
  const model = cfg.model || "retab-small";
  const nConsensus = cfg.n_consensus ?? 1;
  const allowOverlap = cfg.allow_overlap === true;

  return `<?php
require 'vendor/autoload.php';

use Retab\\Client;

$client = new Client(apiKey: ${phpStringLiteral(apiKey)});

$result = $client->partitions()->create(
    document: 'path/to/your/file',
    key: ${phpStringLiteral(key)},
    instructions: ${phpStringLiteral(instructions)},
    model: ${phpStringLiteral(model)},
    nConsensus: ${nConsensus},
    allowOverlap: ${allowOverlap ? "true" : "false"},
);

foreach ($result->output as $chunk) {
    echo '  ' . $chunk->key . ': pages ' . implode(', ', $chunk->pages) . PHP_EOL;
}
`;
};

export const generateDotnetCode = (
  cfg: PartitionConfig,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const key = cfg.key?.trim() || DEFAULT_KEY;
  const instructions = cfg.instructions?.trim() || DEFAULT_INSTRUCTIONS;
  const model = cfg.model || "retab-small";
  const nConsensus = cfg.n_consensus ?? 1;
  const allowOverlap = cfg.allow_overlap === true;

  return `using Retab;
using RetabClient = Retab.Retab;

var client = new RetabClient("${apiKey}");

var result = await client.Partitions.CreateAsync(new PartitionsCreateOptions
{
    Document = MimeData.FromFile("path/to/your/file.pdf"),
    Key = "${key}",
    Instructions = ${JSON.stringify(instructions)},
    Model = "${model}",
    NConsensus = ${nConsensus},
    AllowOverlap = ${allowOverlap ? "true" : "false"},
});

foreach (var chunk in result.Output)
{
    Console.WriteLine($"  {chunk.Key}: pages {string.Join(", ", chunk.Pages)}");
}
`;
};

export const generateRubyCode = (
  cfg: PartitionConfig,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const key = cfg.key?.trim() || DEFAULT_KEY;
  const instructions = cfg.instructions?.trim() || DEFAULT_INSTRUCTIONS;
  const model = cfg.model || "retab-small";
  const nConsensus = cfg.n_consensus ?? 1;
  const allowOverlap = cfg.allow_overlap === true;

  return `require 'retab'

client = Retab::Client.new(api_key: ${JSON.stringify(apiKey)})

result = client.partitions.create(
  document: 'path/to/your/file',
  key: ${JSON.stringify(key)},
  instructions: ${JSON.stringify(instructions)},
  model: ${JSON.stringify(model)},
  n_consensus: ${nConsensus},
  allow_overlap: ${allowOverlap ? "true" : "false"},
)

result.output.each do |chunk|
  puts "  #{chunk.key}: pages #{chunk.pages.join(', ')}"
end
`;
};

export const generateRustCode = (
  cfg: PartitionConfig,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const key = cfg.key?.trim() || DEFAULT_KEY;
  const instructions = cfg.instructions?.trim() || DEFAULT_INSTRUCTIONS;
  const model = cfg.model || "retab-small";
  const nConsensus = cfg.n_consensus ?? 1;
  const allowOverlap = cfg.allow_overlap === true;

  return `use retab::{resources::partitions, Retab};

let client = Retab::new(${rustStringLiteral(apiKey)});
let mut params = partitions::CreateParams::new(
    "path/to/your/file.pdf",
    ${rustStringLiteral(key)},
    ${rustStringLiteral(instructions)},
);
params.body.model = Some(${rustStringLiteral(model)}.to_string());
params.body.n_consensus = Some(${nConsensus});
params.body.allow_overlap = Some(${allowOverlap});

let _result = client.partitions().create(params).await?;

println!("Partition completed");
`;
};

export const generateJavaCode = (
  cfg: PartitionConfig,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const key = cfg.key?.trim() || DEFAULT_KEY;
  const instructions = cfg.instructions?.trim() || DEFAULT_INSTRUCTIONS;
  const model = cfg.model || "retab-small";
  const nConsensus = cfg.n_consensus ?? 1;
  const allowOverlap = cfg.allow_overlap === true;

  return javaMainSnippet(
    ["import com.retab.RetabClient;", "import com.retab.models.Partition;"],
    `
RetabClient client = new RetabClient(${javaStringLiteral(apiKey)});
Partition result = client.partitions().create(
    "path/to/your/file.pdf",
    ${javaStringLiteral(key)},
    ${javaStringLiteral(instructions)},
    ${javaStringLiteral(model)},
    ${nConsensus}L,
    ${allowOverlap},
    false,
    false);

System.out.println("Partition completed: " + result);
`,
  );
};

export const generateCurlCode = (
  cfg: PartitionConfig,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const key = cfg.key?.trim() || DEFAULT_KEY;
  const instructions = cfg.instructions?.trim() || DEFAULT_INSTRUCTIONS;
  const model = cfg.model || "retab-small";
  const nConsensus = cfg.n_consensus ?? 1;
  const allowOverlap = cfg.allow_overlap === true;

  const jsonPayload = {
    document: {
      filename: "your-document.pdf",
      url: "data:application/pdf;base64,<BASE64_ENCODED_FILE_CONTENT>",
    },
    key,
    instructions,
    model,
    n_consensus: nConsensus,
    allow_overlap: allowOverlap,
  };

  const backendUrl =
    typeof window !== "undefined" &&
    window.location?.origin?.includes("localhost")
      ? "http://localhost:8000"
      : "https://api.retab.com";

  return `curl -X POST "${backendUrl}/v1/partitions" \\
  -H "Content-Type: application/json" \\
  -H "Api-Key: ${apiKey}" \\
  -d '${JSON.stringify(jsonPayload, null, 2)}'

# To encode your file as base64:
# base64 -i your-document.pdf

# Example response:
# {
#   "output": [
#     {"key": "INV-001", "pages": [1, 2]},
#     {"key": "INV-002", "pages": [3, 4, 5]}
#   ]
# }`;
};

interface CodeSectionProps {
  configValues: PartitionConfig;
  onClose: () => void;
}

const CodeSection = ({ configValues, onClose }: CodeSectionProps) => {
  const [newKeyCredentials, setNewKeyCredentials] = useState<NewAPIKey | null>(
    null,
  );
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  // UI signaling only: hide API-key creation when the org RBAC capability is
  // absent. The backend route remains the security boundary.
  const canCreateApiKey = useCanOrganization("rbac:api_key:create");

  const handleCreateKey = async () => {
    // Fail-closed guard: never call the mutation without the capability.
    if (!canCreateApiKey) {
      return;
    }
    setIsCreatingKey(true);
    try {
      const response = await fetchWithAuth(
        process.env.NEXT_PUBLIC_BACKEND_BASE_URL + "/v1/api-keys",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `api-key-${Date.now()}` }),
        },
      );
      if (!response.ok) throw new Error();
      const data = await response.json();
      setNewKeyCredentials(data);
      toast.success("API key created successfully");
    } catch {
      toast.error("Failed to create API key");
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleCopyKey = async () => {
    if (newKeyCredentials) {
      await navigator.clipboard.writeText(newKeyCredentials.key);
      setCopiedKey(true);
      toast.success("API key copied to clipboard");
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const getDisplayApiKey = () =>
    newKeyCredentials ? newKeyCredentials.key : "YOUR_RETAB_API_KEY";

  const pythonCode = generateRetabPartitionCode(
    configValues,
    getDisplayApiKey(),
  );
  const typescriptCode = generateTypeScriptCode(
    configValues,
    getDisplayApiKey(),
  );
  const generatedSdkSnippets = [
    {
      value: "go",
      label: "Go",
      icon: "go",
      language: "go",
      code: generateGoCode(configValues, getDisplayApiKey()),
    },
    {
      value: "php",
      label: "PHP",
      icon: "php",
      language: "php",
      code: generatePhpCode(configValues, getDisplayApiKey()),
    },
    {
      value: "dotnet",
      label: ".NET",
      icon: "dotnet",
      language: "csharp",
      code: generateDotnetCode(configValues, getDisplayApiKey()),
    },
    {
      value: "ruby",
      label: "Ruby",
      icon: "ruby",
      language: "ruby",
      code: generateRubyCode(configValues, getDisplayApiKey()),
    },
    {
      value: "rust",
      label: "Rust",
      icon: "rust",
      language: "rust",
      code: generateRustCode(configValues, getDisplayApiKey()),
    },
    {
      value: "java",
      label: "Java",
      icon: "java",
      language: "java",
      code: generateJavaCode(configValues, getDisplayApiKey()),
    },
  ] as const;
  const curlCode = generateCurlCode(configValues, getDisplayApiKey());

  return (
    <>
      <motion.div
        key="code-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      <motion.div
        key="code-panel"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "tween", duration: 0.25 }}
        className="border-border fixed top-0 bottom-0 left-0 z-50 flex w-full flex-col border-r bg-white shadow-xl md:w-4/5 lg:w-2/3"
      >
        <Tabs
          defaultValue="python"
          className="flex min-h-0 flex-1 flex-col gap-0 bg-white"
        >
          <div className="flex items-center justify-between border-b p-4">
            <TabsList className="flex h-8 max-w-full gap-[1px] overflow-x-auto rounded-full bg-gray-50 p-0">
              <TabsTrigger
                value="python"
                className="h-8 rounded-full border-none bg-gray-50 px-3 text-xs shadow-none hover:bg-gray-100 data-[state=active]:bg-gray-200 data-[state=active]:shadow-none"
              >
                <PythonLogo className="h-4 w-4" /> Python
              </TabsTrigger>
              <TabsTrigger
                value="typescript"
                className="h-8 rounded-full border-none bg-gray-50 px-3 text-xs shadow-none hover:bg-gray-100 data-[state=active]:bg-gray-200 data-[state=active]:shadow-none"
              >
                <TypeScriptLogo className="h-4 w-4" /> TypeScript
              </TabsTrigger>
              {generatedSdkSnippets.map((snippet) => (
                <TabsTrigger
                  key={snippet.value}
                  value={snippet.value}
                  className="h-8 rounded-full border-none bg-gray-50 px-3 text-xs shadow-none hover:bg-gray-100 data-[state=active]:bg-gray-200 data-[state=active]:shadow-none"
                >
                  <SnippetLanguageIcon icon={snippet.icon} />
                  {snippet.label}
                </TabsTrigger>
              ))}
              <TabsTrigger
                value="curl"
                className="h-8 rounded-full border-none bg-gray-50 px-3 text-xs shadow-none hover:bg-gray-100 data-[state=active]:bg-gray-200 data-[state=active]:shadow-none"
              >
                <Terminal className="h-4 w-4" /> cURL
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              {newKeyCredentials ? (
                <div
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-pink-200 bg-pink-50 px-3 py-1.5 transition-colors hover:bg-pink-100"
                  onClick={handleCopyKey}
                >
                  <span className="max-w-[200px] truncate font-mono text-xs text-pink-800">
                    {newKeyCredentials.key}
                  </span>
                  {copiedKey ? (
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-pink-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 flex-shrink-0 text-pink-600" />
                  )}
                </div>
              ) : (
                canCreateApiKey && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={handleCreateKey}
                    disabled={isCreatingKey}
                  >
                    {isCreatingKey ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="mr-2 h-4 w-4" />
                    )}
                    {isCreatingKey ? "Creating..." : "Generate API Key"}
                  </Button>
                )
              )}

              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>

          <TabsContent value="python" className="min-h-0 flex-1 overflow-auto">
            <div className="relative h-full">
              <Button
                variant="outline"
                size="sm"
                className="bg-background/80 absolute top-2 right-2 z-10 h-8 w-8 p-0 backdrop-blur-sm"
                onClick={() => {
                  navigator.clipboard.writeText(pythonCode);
                  toast.success("Code has been copied to your clipboard");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <SyntaxHighlighter
                language="python"
                style={oneLight}
                showLineNumbers
                wrapLines
                lineProps={{ style: { background: "white" } }}
                wrapLongLines
                customStyle={{
                  backgroundColor: "white",
                  fontSize: "12px",
                  height: "100%",
                  margin: 0,
                  padding: "12px 0",
                }}
              >
                {pythonCode}
              </SyntaxHighlighter>
            </div>
          </TabsContent>

          <TabsContent
            value="typescript"
            className="min-h-0 flex-1 overflow-auto"
          >
            <div className="relative h-full">
              <Button
                variant="outline"
                size="sm"
                className="bg-background/80 absolute top-2 right-2 z-10 h-8 w-8 p-0 backdrop-blur-sm"
                onClick={() => {
                  navigator.clipboard.writeText(typescriptCode);
                  toast.success("Code has been copied to your clipboard");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <SyntaxHighlighter
                language="typescript"
                style={oneLight}
                showLineNumbers
                wrapLines
                lineProps={{ style: { background: "white" } }}
                wrapLongLines
                customStyle={{
                  backgroundColor: "white",
                  fontSize: "12px",
                  height: "100%",
                  margin: 0,
                  padding: "12px 0",
                }}
              >
                {typescriptCode}
              </SyntaxHighlighter>
            </div>
          </TabsContent>

          {generatedSdkSnippets.map((snippet) => (
            <TabsContent
              key={snippet.value}
              value={snippet.value}
              className="min-h-0 flex-1 overflow-auto"
            >
              <div className="relative h-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/80 absolute top-2 right-2 z-10 h-8 w-8 p-0 backdrop-blur-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(snippet.code);
                    toast.success("Code has been copied to your clipboard");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <SyntaxHighlighter
                  language={snippet.language}
                  style={oneLight}
                  showLineNumbers
                  wrapLines
                  lineProps={{ style: { background: "white" } }}
                  wrapLongLines
                  customStyle={{
                    backgroundColor: "white",
                    fontSize: "12px",
                    height: "100%",
                    margin: 0,
                    padding: "12px 0",
                  }}
                >
                  {snippet.code}
                </SyntaxHighlighter>
              </div>
            </TabsContent>
          ))}

          <TabsContent value="curl" className="min-h-0 flex-1 overflow-auto">
            <div className="relative h-full">
              <Button
                variant="outline"
                size="sm"
                className="bg-background/80 absolute top-2 right-2 z-10 h-8 w-8 p-0 backdrop-blur-sm"
                onClick={() => {
                  navigator.clipboard.writeText(curlCode);
                  toast.success("Code has been copied to your clipboard");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <SyntaxHighlighter
                language="bash"
                style={oneLight}
                showLineNumbers
                wrapLines
                lineProps={{ style: { background: "white" } }}
                wrapLongLines
                customStyle={{
                  backgroundColor: "white",
                  fontSize: "12px",
                  height: "100%",
                  margin: 0,
                  padding: "12px 12px",
                }}
              >
                {curlCode}
              </SyntaxHighlighter>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </>
  );
};

export default CodeSection;
