import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import SyntaxHighlighter from "@/app/components/syntax-highlighter";
import { oneLight } from "@/app/shared/syntax-highlighter-styles";
import { SplitConfigSubdocument } from "@/app/dashboard/widgets/types/split";
import { toast } from "sonner";
import { Copy, Terminal, Key, Loader2, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import PythonLogo from "@/public/logos/python_logo_2.svg";
import TypeScriptLogo from "@/public/logos/typescript_logo.svg";
import { fetchWithAuth } from "@/backend/client-auth-utils";
import { useCanOrganization } from "@/app/dashboard/shared/authz/authorization-checks";
import {
  csharpVerbatimJsonLiteral,
  goRawJsonLiteral,
  goStringLiteral,
  javaMainSnippet,
  javaStringLiteral,
  phpJsonLiteral,
  phpStringLiteral,
  rubyJsonLiteral,
  rustStringLiteral,
} from "@/app/dashboard/playground/components/snippet-literals";
import { SnippetLanguageIcon } from "@/app/dashboard/playground/components/snippet-language-icon";

interface NewAPIKey {
  key: string;
  name: string;
  created_at: string;
  organization_id: string;
}

interface SplitFormData {
  model: string;
  subdocuments: SplitConfigSubdocument[];
}

const generateSubdocumentEntry = (s: SplitConfigSubdocument): string => {
  const fields = [`"name": "${s.name}"`, `"description": "${s.description}"`];
  if (s.allow_multiple_instances) {
    fields.push('"allow_multiple_instances": true');
  }
  return `    {${fields.join(", ")}}`;
};

const generateSubdocumentsCode = (subdocuments: SplitConfigSubdocument[]) => {
  if (subdocuments.length === 0) {
    return `[
    {"name": "Invoice", "description": "Commercial invoices with line items and totals"},
    {"name": "Contract", "description": "Legal contracts and agreements"},
]`;
  }
  return `[
${subdocuments.map(generateSubdocumentEntry).join(",\n")}
]`;
};

export const generateRetabSplitCode = (
  configValues: SplitFormData,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const subdocumentsCode = generateSubdocumentsCode(configValues.subdocuments);

  return `# ---------------------------------------------
# Variables from your configuration
# ---------------------------------------------
api_key = "${apiKey}"
document = "path/to/your/file"
model = "${configValues.model || "gemini-2.5-flash"}"
subdocuments = ${subdocumentsCode}

# ---------------------------------------------
# ---------------------------------------------

from retab import Retab

client = Retab(api_key=api_key)
split_result = client.splits.create(
    document=document,
    model=model,
    subdocuments=subdocuments,
)

print("Document split results:")
for split in split_result.output:
    print(f"  {split.name}: pages {', '.join(map(str, split.pages))}")

print(f"\\nTotal sections: {len(split_result.output)}")
`;
};

export const generateTypeScriptCode = (
  configValues: SplitFormData,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const generateTsEntry = (s: SplitConfigSubdocument): string => {
    const fields = [`name: "${s.name}"`, `description: "${s.description}"`];
    if (s.allow_multiple_instances) {
      fields.push("allow_multiple_instances: true");
    }
    return `    { ${fields.join(", ")} }`;
  };

  const subdocumentsCode =
    configValues.subdocuments.length === 0
      ? `[
    { name: "Invoice", description: "Commercial invoices with line items and totals" },
    { name: "Contract", description: "Legal contracts and agreements" },
]`
      : `[
${configValues.subdocuments.map(generateTsEntry).join(",\n")}
]`;

  return `import { Retab } from '@retab/node';

const apiKey = "${apiKey}";

const client = new Retab({ apiKey });

const subdocuments = ${subdocumentsCode};

const result = await client.splits.create(
    "path/to/your/file",
    subdocuments,
    "${configValues.model || "gemini-2.5-flash"}"
);

console.log("Document split results:");
result.output.forEach((split) => {
    console.log(\`  \${split.name}: pages \${split.pages.join(', ')}\`);
});

console.log(\`\\nTotal sections: \${result.output.length}\`);
`;
};

const getSplitSubdocuments = (configValues: SplitFormData) =>
  configValues.subdocuments.length === 0
    ? [
        {
          name: "Invoice",
          description: "Commercial invoices with line items and totals",
        },
        { name: "Contract", description: "Legal contracts and agreements" },
      ]
    : configValues.subdocuments.map((s) => ({
        name: s.name,
        description: s.description,
        ...(s.allow_multiple_instances
          ? { allow_multiple_instances: true }
          : {}),
      }));

export const generateGoCode = (
  configValues: SplitFormData,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const subdocuments = getSplitSubdocuments(configValues);

  return `import (
    "context"
    "encoding/json"
    "fmt"

    retab "github.com/retab-dev/retab/clients/go"
)

ctx := context.Background()
client, err := retab.NewClient(${goStringLiteral(apiKey)})
if err != nil {
    panic(err)
}

var payload []struct {
    Name                   string  \`json:"name"\`
    Description            *string \`json:"description,omitempty"\`
    AllowMultipleInstances *bool   \`json:"allow_multiple_instances,omitempty"\`
}
if err := json.Unmarshal([]byte(${goRawJsonLiteral(subdocuments)}), &payload); err != nil {
    panic(err)
}

subdocuments := make([]*retab.Subdocument, 0, len(payload))
for _, item := range payload {
    subdocuments = append(subdocuments, &retab.Subdocument{
        Name: item.Name,
        Description: item.Description,
        AllowMultipleInstances: item.AllowMultipleInstances,
    })
}

model := ${goStringLiteral(configValues.model || "gemini-2.5-flash")}
result, err := client.Splits.Create(ctx, &retab.SplitsCreateParams{
    Document: "path/to/your/file",
    Subdocuments: subdocuments,
    Model: &model,
})
if err != nil {
    panic(err)
}

fmt.Println("Document split results:")
for _, split := range result.Output {
    fmt.Printf("  %s: pages %v\\n", split.Name, split.Pages)
}
`;
};

export const generatePhpCode = (
  configValues: SplitFormData,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const subdocuments = getSplitSubdocuments(configValues);

  return `<?php
require 'vendor/autoload.php';

use Retab\\Client;

$client = new Client(apiKey: ${phpStringLiteral(apiKey)});
$subdocuments = json_decode(${phpJsonLiteral(subdocuments)}, true);

$result = $client->splits()->create(
    document: 'path/to/your/file',
    subdocuments: $subdocuments,
    model: ${phpStringLiteral(configValues.model || "gemini-2.5-flash")},
);

foreach ($result->output as $split) {
    echo '  ' . $split->name . ': pages ' . implode(', ', $split->pages) . PHP_EOL;
}
`;
};

export const generateDotnetCode = (
  configValues: SplitFormData,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const subdocuments = getSplitSubdocuments(configValues);

  return `using Newtonsoft.Json;
using Retab;
using RetabClient = Retab.Retab;

var client = new RetabClient("${apiKey}");
var subdocuments = JsonConvert.DeserializeObject<List<Subdocument>>(${csharpVerbatimJsonLiteral(subdocuments)})!;

var result = await client.Splits.CreateAsync(new SplitsCreateOptions
{
    Document = MimeData.FromFile("path/to/your/file.pdf"),
    Subdocuments = subdocuments,
    Model = "${configValues.model || "gemini-2.5-flash"}",
});

foreach (var split in result.Output)
{
    Console.WriteLine($"  {split.Name}: pages {string.Join(", ", split.Pages)}");
}
`;
};

export const generateRubyCode = (
  configValues: SplitFormData,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const subdocuments = getSplitSubdocuments(configValues);

  return `require 'json'
require 'retab'

client = Retab::Client.new(api_key: ${JSON.stringify(apiKey)})
subdocuments = JSON.parse(${rubyJsonLiteral(subdocuments)})

result = client.splits.create(
  document: 'path/to/your/file',
  subdocuments: subdocuments,
  model: ${JSON.stringify(configValues.model || "gemini-2.5-flash")},
)

result.output.each do |split|
  puts "  #{split.name}: pages #{split.pages.join(', ')}"
end
`;
};

export const generateRustCode = (
  configValues: SplitFormData,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const subdocuments = getSplitSubdocuments(configValues);
  const subdocumentLines = subdocuments
    .map(
      (subdocument) => `{
        let mut subdocument = Subdocument::new(${rustStringLiteral(subdocument.name)});
        subdocument.description = Some(${rustStringLiteral(subdocument.description || "")}.to_string());
        ${subdocument.allow_multiple_instances ? "subdocument.allow_multiple_instances = Some(true);" : ""}
        subdocument
    }`,
    )
    .join(",\n    ");

  return `use retab::{models::Subdocument, resources::splits, Retab};

let client = Retab::new(${rustStringLiteral(apiKey)});
let subdocuments = vec![
    ${subdocumentLines},
];

let mut params = splits::CreateParams::new("path/to/your/file.pdf", subdocuments);
params.body.model = Some(${rustStringLiteral(configValues.model || "gemini-2.5-flash")}.to_string());

let _result = client.splits().create(params).await?;

println!("Split completed");
`;
};

export const generateJavaCode = (
  configValues: SplitFormData,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const subdocuments = getSplitSubdocuments(configValues);
  const subdocumentLines = subdocuments
    .map(
      (subdocument) =>
        `    new Subdocument(${javaStringLiteral(subdocument.name)}, ${javaStringLiteral(subdocument.description || "")}, ${subdocument.allow_multiple_instances ? "true" : "false"})`,
    )
    .join(",\n");

  return javaMainSnippet(
    [
      "import com.retab.RetabClient;",
      "import com.retab.models.Split;",
      "import com.retab.models.Subdocument;",
      "import java.util.List;",
    ],
    `
RetabClient client = new RetabClient(${javaStringLiteral(apiKey)});
List<Subdocument> subdocuments = List.of(
${subdocumentLines}
);

Split result = client.splits().create(
    "path/to/your/file.pdf",
    subdocuments,
    ${javaStringLiteral(configValues.model || "gemini-2.5-flash")},
    null,
    null,
    false,
    false);

System.out.println("Split completed: " + result);
`,
  );
};

export const generateCurlCode = (
  configValues: SplitFormData,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const subdocuments =
    configValues.subdocuments.length === 0
      ? [
          {
            name: "Invoice",
            description: "Commercial invoices with line items and totals",
          },
          { name: "Contract", description: "Legal contracts and agreements" },
        ]
      : configValues.subdocuments;

  const jsonPayload = {
    document: {
      filename: "your-document.pdf",
      url: "data:application/pdf;base64,<BASE64_ENCODED_FILE_CONTENT>",
    },
    model: configValues.model || "gemini-2.5-flash",
    subdocuments: subdocuments.map((s) => ({
      name: s.name,
      description: s.description,
      ...(s.allow_multiple_instances ? { allow_multiple_instances: true } : {}),
    })),
  };

  const pageOrigin =
    typeof window !== "undefined" ? window.location?.origin : undefined;
  const backendUrl = pageOrigin?.includes("localhost")
    ? "http://localhost:8000"
    : "https://api.retab.com";

  return `curl -X POST "${backendUrl}/v1/splits" \\
  -H "Content-Type: application/json" \\
  -H "Api-Key: ${apiKey}" \\
  -d '${JSON.stringify(jsonPayload, null, 2)}'

# To encode your file as base64:
# base64 -i your-document.pdf

# Example response:
# {
#   "output": [
#     {"name": "Invoice", "pages": [1, 2, 3]},
#     {"name": "Contract", "pages": [4, 5, 6, 7, 8]}
#   ]
# }`;
};

interface CodeSectionProps {
  configValues: SplitFormData;
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
          headers: {
            "Content-Type": "application/json",
          },
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

  const getDisplayApiKey = () => {
    if (newKeyCredentials) {
      return newKeyCredentials.key;
    }
    return "YOUR_RETAB_API_KEY";
  };

  const generateRetabSplitCodeWithActualVariables = () => {
    return generateRetabSplitCode(configValues, getDisplayApiKey());
  };

  const generateTypeScriptCodeWithActualVariables = () => {
    return generateTypeScriptCode(configValues, getDisplayApiKey());
  };

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

  const generateCurlCodeWithActualVariables = () => {
    return generateCurlCode(configValues, getDisplayApiKey());
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="code-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Sliding Panel */}
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
          {/* Header with Tabs */}
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

          {/* Content */}
          <TabsContent value="python" className="min-h-0 flex-1 overflow-auto">
            <div className="relative h-full">
              <Button
                variant="outline"
                size="sm"
                className="bg-background/80 absolute top-2 right-2 z-10 h-8 w-8 p-0 backdrop-blur-sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    generateRetabSplitCodeWithActualVariables(),
                  );
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
                {generateRetabSplitCodeWithActualVariables()}
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
                  navigator.clipboard.writeText(
                    generateTypeScriptCodeWithActualVariables(),
                  );
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
                {generateTypeScriptCodeWithActualVariables()}
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
                  navigator.clipboard.writeText(
                    generateCurlCodeWithActualVariables(),
                  );
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
                {generateCurlCodeWithActualVariables()}
              </SyntaxHighlighter>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </>
  );
};

export default CodeSection;
