import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import SyntaxHighlighter from "@/app/components/syntax-highlighter";
import { oneLight } from "@/app/shared/syntax-highlighter-styles";
import { ParseRequest } from "@/app/dashboard/widgets/types/parse";
import { toast } from "sonner";
import { Copy, Terminal, Key, Loader2, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import PythonLogo from "@/public/logos/python_logo_2.svg";
import TypeScriptLogo from "@/public/logos/typescript_logo.svg";
import { fetchWithAuth } from "@/backend/client-auth-utils";
import { useCanOrganization } from "@/app/dashboard/shared/authz/authorization-checks";
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

const generateCommonSetupCode = (
  configValues: ParseRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const setupVars = [
    `api_key = "${apiKey}"`,
    `document = "path/to/your/file"`,
    `model = "${configValues.model || "gpt-5.4"}"`,
    `table_parsing_format = "${configValues.table_parsing_format || "html"}"`,
    `image_resolution_dpi = ${configValues.image_resolution_dpi || 128}`,
  ] as const;

  return `# ---------------------------------------------
## Variables from your configuration
# ---------------------------------------------
${setupVars.join("\n")}`;
};

export const generateRetabParseCode = (
  configValues: ParseRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const setupCode = generateCommonSetupCode(configValues, apiKey);

  const parseArgsList = [
    "document = document",
    "model = model",
    "table_parsing_format = table_parsing_format",
    "image_resolution_dpi = image_resolution_dpi",
  ];

  return `${setupCode}
# ---------------------------------------------
# ---------------------------------------------

from retab import Retab

client = Retab(api_key=api_key)
result = client.parses.create(
    ${parseArgsList.join(",\n    ")}
)

print("Parsed content:")
for i, page_content in enumerate(result.output.pages):
    print(f"Page {i + 1}:")
    print(page_content)
    print("\\n" + "="*50 + "\\n")

if result.usage:
    print(f"Total pages: {len(result.output.pages)}")
    print(f"Credits used: {result.usage.credits}")
`;
};

export const generateTypeScriptCode = (
  configValues: ParseRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  return `import { Retab } from '@retab/node';

const apiKey = "${apiKey}";

const client = new Retab({ apiKey });

const result = await client.parses.create(
    "path/to/your/file",
    "${configValues.model || "gemini-2.5-flash"}",
    "${configValues.table_parsing_format || "html"}",
    ${configValues.image_resolution_dpi || 96}
);

// Access parsed content
result.output.pages.forEach((pageContent: string, index: number) => {
    console.log(\`Page \${index + 1}:\`);
    console.log(pageContent);
    console.log("\\n" + "=".repeat(50) + "\\n");
});

if (result.usage) {
    console.log(\`Total pages: \${result.output.pages.length}\`);
    console.log(\`Credits used: \${result.usage.credits}\`);
}
`;
};

const goTableParsingFormat = (format: string) => {
  switch (format) {
    case "markdown":
      return "retab.ParseRequestTableParsingFormatMarkdown";
    case "yaml":
      return "retab.ParseRequestTableParsingFormatYaml";
    case "json":
      return "retab.ParseRequestTableParsingFormatJSON";
    case "html":
    default:
      return "retab.ParseRequestTableParsingFormatHTML";
  }
};

const dotnetTableParsingFormat = (format: string) => {
  switch (format) {
    case "markdown":
      return "ParseRequestTableParsingFormat.Markdown";
    case "yaml":
      return "ParseRequestTableParsingFormat.Yaml";
    case "json":
      return "ParseRequestTableParsingFormat.Json";
    case "html":
    default:
      return "ParseRequestTableParsingFormat.Html";
  }
};

const rustTableParsingFormat = (format: string) => {
  switch (format) {
    case "markdown":
      return "retab::enums::ParseRequestTableParsingFormat::Markdown";
    case "yaml":
      return "retab::enums::ParseRequestTableParsingFormat::Yaml";
    case "json":
      return "retab::enums::ParseRequestTableParsingFormat::Json";
    case "html":
    default:
      return "retab::enums::ParseRequestTableParsingFormat::Html";
  }
};

const javaTableParsingFormat = (format: string) => {
  switch (format) {
    case "markdown":
      return "ParseRequestTableParsingFormat.MARKDOWN";
    case "yaml":
      return "ParseRequestTableParsingFormat.YAML";
    case "json":
      return "ParseRequestTableParsingFormat.JSON";
    case "html":
    default:
      return "ParseRequestTableParsingFormat.HTML";
  }
};

export const generateGoCode = (
  configValues: ParseRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const model = configValues.model || "gpt-5.4";
  const format = configValues.table_parsing_format || "html";
  const dpi = configValues.image_resolution_dpi || 128;

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
tableParsingFormat := ${goTableParsingFormat(format)}
imageResolutionDpi := ${dpi}
result, err := client.Parses.Create(ctx, &retab.ParsesCreateParams{
    Document: "path/to/your/file",
    Model: &model,
    TableParsingFormat: &tableParsingFormat,
    ImageResolutionDpi: &imageResolutionDpi,
})
if err != nil {
    panic(err)
}

for index, page := range result.Output.Pages {
    fmt.Printf("Page %d:\\n%s\\n", index+1, page)
}
`;
};

export const generatePhpCode = (
  configValues: ParseRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  return `<?php
require 'vendor/autoload.php';

use Retab\\Client;

$client = new Client(apiKey: ${phpStringLiteral(apiKey)});

$result = $client->parses()->create(
    document: 'path/to/your/file',
    model: ${phpStringLiteral(configValues.model || "gpt-5.4")},
    tableParsingFormat: ${phpStringLiteral(configValues.table_parsing_format || "html")},
    imageResolutionDpi: ${configValues.image_resolution_dpi || 128},
);

foreach ($result->output->pages as $index => $page) {
    echo 'Page ' . ($index + 1) . ':' . PHP_EOL;
    echo $page . PHP_EOL;
}
`;
};

export const generateDotnetCode = (
  configValues: ParseRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const format = configValues.table_parsing_format || "html";

  return `using Retab;
using RetabClient = Retab.Retab;

var client = new RetabClient("${apiKey}");

var result = await client.Parses.CreateAsync(new ParsesCreateOptions
{
    Document = MimeData.FromFile("path/to/your/file.pdf"),
    Model = "${configValues.model || "gpt-5.4"}",
    TableParsingFormat = ${dotnetTableParsingFormat(format)},
    ImageResolutionDpi = ${configValues.image_resolution_dpi || 128},
});

for (var index = 0; index < result.Output.Pages.Count; index++)
{
    Console.WriteLine($"Page {index + 1}:");
    Console.WriteLine(result.Output.Pages[index]);
}
`;
};

export const generateRubyCode = (
  configValues: ParseRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  return `require 'retab'

client = Retab::Client.new(api_key: ${JSON.stringify(apiKey)})

result = client.parses.create(
  document: 'path/to/your/file',
  model: ${JSON.stringify(configValues.model || "gpt-5.4")},
  table_parsing_format: ${JSON.stringify(configValues.table_parsing_format || "html")},
  image_resolution_dpi: ${configValues.image_resolution_dpi || 128},
)

result.output.pages.each_with_index do |page, index|
  puts "Page #{index + 1}:"
  puts page
end
`;
};

export const generateRustCode = (
  configValues: ParseRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const model = configValues.model || "gpt-5.4";
  const format = configValues.table_parsing_format || "html";
  const dpi = configValues.image_resolution_dpi || 128;

  return `use retab::{resources::parses, Retab};

let client = Retab::new(${rustStringLiteral(apiKey)});
let mut params = parses::CreateParams::new("path/to/your/file.pdf");
params.body.model = Some(${rustStringLiteral(model)}.to_string());
params.body.table_parsing_format = Some(${rustTableParsingFormat(format)});
params.body.image_resolution_dpi = Some(${dpi});

let _result = client.parses().create(params).await?;

println!("Parse completed");
`;
};

export const generateJavaCode = (
  configValues: ParseRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const model = configValues.model || "gpt-5.4";
  const format = configValues.table_parsing_format || "html";
  const dpi = configValues.image_resolution_dpi || 128;

  return javaMainSnippet(
    [
      "import com.retab.RetabClient;",
      "import com.retab.models.Parse;",
      "import com.retab.types.ParseRequestTableParsingFormat;",
    ],
    `
RetabClient client = new RetabClient(${javaStringLiteral(apiKey)});
Parse result = client.parses().create(
    "path/to/your/file.pdf",
    ${javaStringLiteral(model)},
    ${javaTableParsingFormat(format)},
    ${dpi}L,
    null,
    false,
    false);

System.out.println("Parse completed: " + result);
`,
  );
};

export const generateCurlCode = (
  configValues: ParseRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const jsonPayload = {
    document: {
      filename: "your-document.pdf",
      url: "data:application/pdf;base64,<BASE64_ENCODED_FILE_CONTENT>",
    },
    model: configValues.model || "gpt-5.4",
    table_parsing_format: configValues.table_parsing_format || "html",
    image_resolution_dpi: configValues.image_resolution_dpi || 72,
  };

  const backendUrl =
    typeof window !== "undefined" &&
    window.location?.origin?.includes("localhost")
      ? "http://localhost:8000"
      : "https://api.retab.com";

  return `curl -X POST "${backendUrl}/v1/parses" \\
  -H "Content-Type: application/json" \\
  -H "Api-Key: ${apiKey}" \\
  -d '${JSON.stringify(jsonPayload, null, 2)}'

# To encode your file as base64:
# base64 -i your-document.pdf

# Example response:
# {
#   "pages": [
#     "Content of page 1...",
#     "Content of page 2...",
#     ...
#   ]
# }`;
};

interface CodeSectionProps {
  configValues: ParseRequest;
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

  const generateRetabParseCodeWithActualVariables = () => {
    return generateRetabParseCode(configValues, getDisplayApiKey());
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
                    generateRetabParseCodeWithActualVariables(),
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
                {generateRetabParseCodeWithActualVariables()}
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
