"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import SyntaxHighlighter from "@/app/components/syntax-highlighter";
import { oneLight } from "@/app/shared/syntax-highlighter-styles";
import { Category } from "@/app/dashboard/widgets/types/classify";
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

interface ClassifyConfigValues {
  model: string;
  categories: Category[];
  first_n_pages?: number;
}

interface CodeSectionProps {
  configValues: ClassifyConfigValues;
  onClose: () => void;
}

const generateCategoriesCode = (categories: Category[]) => {
  if (categories.length === 0) {
    return `[
    {"name": "Invoice", "description": "Commercial invoices with line items and totals"},
    {"name": "Contract", "description": "Legal contracts and agreements"},
]`;
  }
  return `[
${categories.map((cat) => `    {"name": "${cat.name}", "description": "${cat.description}"}`).join(",\n")}
]`;
};

export const generatePythonCode = (
  config: ClassifyConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const categoriesCode = generateCategoriesCode(config.categories);

  const firstNPagesVar = config.first_n_pages
    ? `\nfirst_n_pages = ${config.first_n_pages}`
    : "";
  const firstNPagesArg = config.first_n_pages
    ? `\n    first_n_pages=first_n_pages,`
    : "";

  return `# ---------------------------------------------
# Variables from your configuration
# ---------------------------------------------
api_key = "${apiKey}"
document = "path/to/your/file"
model = "${config.model || "retab-small"}"
categories = ${categoriesCode}${firstNPagesVar}

# ---------------------------------------------
# ---------------------------------------------

from retab import Retab

client = Retab(api_key=api_key)
result = client.classifications.create(
    document=document,
    model=model,
    categories=categories,${firstNPagesArg}
)

print(f"Classification: {result.output.category}")
print(f"Reasoning: {result.output.reasoning}")
`;
};

export const generateTypeScriptCode = (
  config: ClassifyConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const categoriesCode =
    config.categories.length === 0
      ? `[
    { name: "Invoice", description: "Commercial invoices with line items and totals" },
    { name: "Contract", description: "Legal contracts and agreements" },
]`
      : `[
${config.categories.map((cat) => `    { name: "${cat.name}", description: "${cat.description}" }`).join(",\n")}
]`;

  return `import { Retab } from '@retab/node';

const apiKey = "${apiKey}";

const client = new Retab({ apiKey });

const categories = ${categoriesCode};

const result = await client.classifications.create(
    "path/to/your/file",
    categories,
    "${config.model || "retab-small"}",
    ${config.first_n_pages ?? "undefined"}
);

console.log("Classification:", result.output.category);
console.log("Reasoning:", result.output.reasoning);
`;
};

export const generateGoCode = (
  config: ClassifyConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const categories =
    config.categories.length === 0
      ? [
          {
            name: "Invoice",
            description: "Commercial invoices with line items and totals",
          },
          { name: "Contract", description: "Legal contracts and agreements" },
        ]
      : config.categories;

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

var categoriesPayload []struct {
    Name        string  \`json:"name"\`
    Description *string \`json:"description,omitempty"\`
}
if err := json.Unmarshal([]byte(${goRawJsonLiteral(categories)}), &categoriesPayload); err != nil {
    panic(err)
}

categories := make([]*retab.Category, 0, len(categoriesPayload))
for _, category := range categoriesPayload {
    categories = append(categories, &retab.Category{
        Name: category.Name,
        Description: category.Description,
    })
}

model := ${goStringLiteral(config.model || "retab-small")}
${config.first_n_pages ? `firstNPages := ${config.first_n_pages}\n` : ""}result, err := client.Classifications.Create(ctx, &retab.ClassificationsCreateParams{
    Document: "path/to/your/file",
    Categories: categories,
    Model: &model,${config.first_n_pages ? "\n    FirstNPages: &firstNPages," : ""}
})
if err != nil {
    panic(err)
}

fmt.Println("Classification:", result.Output.Category)
fmt.Println("Reasoning:", result.Output.Reasoning)
`;
};

export const generatePhpCode = (
  config: ClassifyConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const categories =
    config.categories.length === 0
      ? [
          {
            name: "Invoice",
            description: "Commercial invoices with line items and totals",
          },
          { name: "Contract", description: "Legal contracts and agreements" },
        ]
      : config.categories;

  return `<?php
require 'vendor/autoload.php';

use Retab\\Client;

$client = new Client(apiKey: ${phpStringLiteral(apiKey)});
$categories = json_decode(${phpJsonLiteral(categories)}, true);

$result = $client->classifications()->create(
    document: 'path/to/your/file',
    categories: $categories,
    model: ${phpStringLiteral(config.model || "retab-small")},${config.first_n_pages ? `\n    firstNPages: ${config.first_n_pages},` : ""}
);

echo "Classification: " . $result->output->category . PHP_EOL;
echo "Reasoning: " . $result->output->reasoning . PHP_EOL;
`;
};

export const generateDotnetCode = (
  config: ClassifyConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const categories =
    config.categories.length === 0
      ? [
          {
            name: "Invoice",
            description: "Commercial invoices with line items and totals",
          },
          { name: "Contract", description: "Legal contracts and agreements" },
        ]
      : config.categories;

  return `using Newtonsoft.Json;
using Retab;
using RetabClient = Retab.Retab;

var client = new RetabClient("${apiKey}");
var categories = JsonConvert.DeserializeObject<List<Category>>(${csharpVerbatimJsonLiteral(categories)})!;

var result = await client.Classifications.CreateAsync(new ClassificationsCreateOptions
{
    Document = MimeData.FromFile("path/to/your/file.pdf"),
    Categories = categories,
    Model = "${config.model || "retab-small"}",${config.first_n_pages ? `\n    FirstNPages = ${config.first_n_pages},` : ""}
});

Console.WriteLine($"Classification: {result.Output.Category}");
Console.WriteLine($"Reasoning: {result.Output.Reasoning}");
`;
};

export const generateRubyCode = (
  config: ClassifyConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const categories =
    config.categories.length === 0
      ? [
          {
            name: "Invoice",
            description: "Commercial invoices with line items and totals",
          },
          { name: "Contract", description: "Legal contracts and agreements" },
        ]
      : config.categories;

  return `require 'json'
require 'retab'

client = Retab::Client.new(api_key: ${JSON.stringify(apiKey)})
categories = JSON.parse(${rubyJsonLiteral(categories)})

result = client.classifications.create(
  document: 'path/to/your/file',
  categories: categories,
  model: ${JSON.stringify(config.model || "retab-small")},${config.first_n_pages ? `\n  first_n_pages: ${config.first_n_pages},` : ""}
)

puts "Classification: #{result.output.category}"
puts "Reasoning: #{result.output.reasoning}"
`;
};

export const generateRustCode = (
  config: ClassifyConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const categories =
    config.categories.length === 0
      ? [
          {
            name: "Invoice",
            description: "Commercial invoices with line items and totals",
          },
          { name: "Contract", description: "Legal contracts and agreements" },
        ]
      : config.categories;
  const categoryLines = categories
    .map(
      (category) => `{
        let mut category = Category::new(${rustStringLiteral(category.name)});
        category.description = Some(${rustStringLiteral(category.description || "")}.to_string());
        category
    }`,
    )
    .join(",\n    ");

  return `use retab::{models::Category, resources::classifications, Retab};

let client = Retab::new(${rustStringLiteral(apiKey)});
let categories = vec![
    ${categoryLines},
];

let mut params = classifications::CreateParams::new("path/to/your/file.pdf", categories);
params.body.model = Some(${rustStringLiteral(config.model || "retab-small")}.to_string());
${config.first_n_pages ? `params.body.first_n_pages = Some(${config.first_n_pages});\n` : ""}let _result = client.classifications().create(params).await?;

println!("Classification completed");
`;
};

export const generateJavaCode = (
  config: ClassifyConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const categories =
    config.categories.length === 0
      ? [
          {
            name: "Invoice",
            description: "Commercial invoices with line items and totals",
          },
          { name: "Contract", description: "Legal contracts and agreements" },
        ]
      : config.categories;
  const categoryLines = categories
    .map(
      (category) =>
        `    new Category(${javaStringLiteral(category.name)}, null, ${javaStringLiteral(category.description || "")})`,
    )
    .join(",\n");

  return javaMainSnippet(
    [
      "import com.retab.RetabClient;",
      "import com.retab.models.Category;",
      "import com.retab.models.Classification;",
      "import java.util.List;",
    ],
    `
RetabClient client = new RetabClient(${javaStringLiteral(apiKey)});
List<Category> categories = List.of(
${categoryLines}
);

Classification result = client.classifications().create(
    "path/to/your/file.pdf",
    categories,
    ${javaStringLiteral(config.model || "retab-small")},
    ${config.first_n_pages ? `${config.first_n_pages}L` : "null"},
    null,
    null,
    false,
    false);

System.out.println("Classification completed: " + result);
`,
  );
};

export const generateCurlCode = (
  config: ClassifyConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const categories =
    config.categories.length === 0
      ? [
          {
            name: "Invoice",
            description: "Commercial invoices with line items and totals",
          },
          { name: "Contract", description: "Legal contracts and agreements" },
        ]
      : config.categories;

  const jsonPayload: Record<string, unknown> = {
    document: {
      filename: "your-document.pdf",
      url: "data:application/pdf;base64,<BASE64_ENCODED_FILE_CONTENT>",
    },
    model: config.model || "retab-small",
    categories: categories.map((cat) => ({
      name: cat.name,
      description: cat.description,
    })),
  };
  if (config.first_n_pages) {
    jsonPayload.first_n_pages = config.first_n_pages;
  }

  const backendUrl =
    typeof window !== "undefined" &&
    window.location?.origin?.includes("localhost")
      ? "http://localhost:8000"
      : "https://api.retab.com";

  return `curl -X POST "${backendUrl}/v1/classifications" \\
  -H "Content-Type: application/json" \\
  -H "Api-Key: ${apiKey}" \\
  -d '${JSON.stringify(jsonPayload, null, 2)}'

# To encode your file as base64:
# base64 -i your-document.pdf

# Example response:
# {
#   "id": "classification_abc123",
#   "output": {
#     "reasoning": "The document contains billing details...",
#     "category": "Invoice"
#   },
#   "consensus": {
#     "choices": [],
#     "likelihoods": null
#   }
# }`;
};

export default function CodeSection({
  configValues,
  onClose,
}: CodeSectionProps) {
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

  const generatePythonCodeWithActualVariables = () => {
    return generatePythonCode(configValues, getDisplayApiKey());
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
                    generatePythonCodeWithActualVariables(),
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
                {generatePythonCodeWithActualVariables()}
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
}
