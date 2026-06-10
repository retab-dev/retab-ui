import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import SyntaxHighlighter from "@/app/components/syntax-highlighter";
import { oneLight } from "@/app/shared/syntax-highlighter-styles";

import { toast } from "sonner";
import { Copy } from "lucide-react";
import { DocumentExtractRequest } from "@/app/dashboard/widgets/types/extract";
import {
  csharpVerbatimJsonLiteral,
  goRawJsonLiteral,
  goStringLiteral,
  javaMainSnippet,
  javaStringLiteral,
  phpJsonLiteral,
  phpStringLiteral,
  rubyJsonLiteral,
  rustRawJsonLiteral,
  rustStringLiteral,
} from "@/app/dashboard/playground/components/snippet-literals";

// Helper function to convert JS objects to Python-formatted strings
export const pythonifyJson = (obj: any, indent = 4): string => {
  if (obj === null) return "None";
  if (obj === undefined) return "None";
  if (typeof obj === "boolean") return obj ? "True" : "False";
  if (typeof obj === "number") return obj.toString();
  if (typeof obj === "string") {
    // Special case for "type": "null" in JSON Schema
    if (obj === "null") return "None";
    return `"${obj.replace(/"/g, '\\"')}"`;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    const items = obj.map((item) => pythonifyJson(item, indent)).join(", ");
    return `[${items}]`;
  }

  if (typeof obj === "object") {
    if (Object.keys(obj).length === 0) return "{}";
    const spaces = " ".repeat(indent);
    const innerSpaces = " ".repeat(indent * 2);

    const entries = Object.entries(obj)
      .map(([key, value]) => {
        // Handle special case for "type": "null"
        if (key === "type" && value === "null") {
          return `${innerSpaces}"${key}": None`;
        }
        return `${innerSpaces}"${key}": ${pythonifyJson(value, indent + 4)}`;
      })
      .join(",\n");

    return `{\n${entries}\n${spaces}}`;
  }

  return String(obj);
};

export const generateCommonSetupCode = (
  currentSchema: Record<string, any>,
  configValues: DocumentExtractRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  // Generate the common setup code with configuration variables
  // Use pythonifyJson instead of escaped JSON string
  const setupVars = [
    `document = "path/to/your/file"`,
    `json_schema = ${pythonifyJson(currentSchema)}`,
    `image_resolution_dpi = ${configValues.image_resolution_dpi}`,
    `model = "${configValues.model}"`,
  ];

  if (configValues.n_consensus && configValues.n_consensus > 1) {
    setupVars.push(`n_consensus = ${configValues.n_consensus}`);
  }

  return `# pip install retab
from retab import Retab

# ---------------------------------------------
## Variables from your configuration
# ---------------------------------------------
api_key = "${apiKey}"
${setupVars.join("\n")}`;
};

// Function to generate Retab API
export const generatePythonRetabCode = (
  currentSchema: Record<string, any>,
  configValues: DocumentExtractRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const setupCode = generateCommonSetupCode(
    currentSchema,
    configValues,
    apiKey,
  );
  // Determine which API to use based on configuration
  // Use Retab API with consensus
  const extractionParseArgsList = [
    "json_schema = json_schema",
    "document = document",
    "model = model",
    "image_resolution_dpi = image_resolution_dpi",
  ];
  if (configValues.n_consensus && configValues.n_consensus > 1) {
    extractionParseArgsList.push("n_consensus = n_consensus");
  }

  return `${setupCode}
# ---------------------------------------------
# ---------------------------------------------

client = Retab(api_key=api_key)
extraction = client.extractions.create(
    ${extractionParseArgsList.join(",\n    ")}
)

print("Result:", extraction.output)
`;
};

// Function to generate TypeScript/JavaScript Retab code
export const generateTypeScriptRetabCode = (
  currentSchema: Record<string, any>,
  configValues: DocumentExtractRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const setupVars = [
    `const apiKey = "${apiKey}";`,
    `const document = "path/to/your/file";`,
    `const jsonSchema = ${JSON.stringify(currentSchema, null, 2)};`,
    `const imageResolutionDpi = ${configValues.image_resolution_dpi};`,
    `const model = "${configValues.model}";`,
  ];

  if (configValues.n_consensus && configValues.n_consensus > 1) {
    setupVars.push(`const nConsensus = ${configValues.n_consensus};`);
  }

  return `// npm install @retab/node
import { Retab } from '@retab/node';

// ---------------------------------------------
// Variables from your configuration
// ---------------------------------------------
${setupVars.join("\n")}

// ---------------------------------------------
// ---------------------------------------------

const client = new Retab({ apiKey });

const extraction = await client.extractions.create(
    document,
    jsonSchema,
    model,
    imageResolutionDpi,
    undefined,
    ${configValues.n_consensus && configValues.n_consensus > 1 ? "nConsensus" : "undefined"}
);

console.log("Result:", extraction.output);
`;
};

export const generateGoCode = (
  currentSchema: Record<string, any>,
  configValues: DocumentExtractRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const hasConsensus = configValues.n_consensus && configValues.n_consensus > 1;

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

var jsonSchema map[string]interface{}
if err := json.Unmarshal([]byte(${goRawJsonLiteral(currentSchema)}), &jsonSchema); err != nil {
    panic(err)
}

model := ${goStringLiteral(configValues.model)}
imageResolutionDpi := ${configValues.image_resolution_dpi}
${hasConsensus ? `nConsensus := ${configValues.n_consensus}\n` : ""}extraction, err := client.Extractions.Create(ctx, &retab.ExtractionsCreateParams{
    Document: "path/to/your/file",
    JSONSchema: jsonSchema,
    Model: &model,
    ImageResolutionDpi: &imageResolutionDpi,${hasConsensus ? "\n    NConsensus: &nConsensus," : ""}
})
if err != nil {
    panic(err)
}

fmt.Println("Result:", extraction.Output)
`;
};

export const generatePhpCode = (
  currentSchema: Record<string, any>,
  configValues: DocumentExtractRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  return `<?php
require 'vendor/autoload.php';

use Retab\\Client;

$client = new Client(apiKey: ${phpStringLiteral(apiKey)});
$jsonSchema = json_decode(${phpJsonLiteral(currentSchema)}, true);

$extraction = $client->extractions()->create(
    document: 'path/to/your/file',
    jsonSchema: $jsonSchema,
    model: ${phpStringLiteral(configValues.model)},
    imageResolutionDpi: ${configValues.image_resolution_dpi},${configValues.n_consensus && configValues.n_consensus > 1 ? `\n    nConsensus: ${configValues.n_consensus},` : ""}
);

print_r($extraction->output);
`;
};

export const generateDotnetCode = (
  currentSchema: Record<string, any>,
  configValues: DocumentExtractRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  return `using Newtonsoft.Json;
using Retab;
using RetabClient = Retab.Retab;

var client = new RetabClient("${apiKey}");
var jsonSchema = JsonConvert.DeserializeObject<Dictionary<string, object>>(${csharpVerbatimJsonLiteral(currentSchema)})!;

var extraction = await client.Extractions.CreateAsync(new ExtractionsCreateOptions
{
    Document = MimeData.FromFile("path/to/your/file.pdf"),
    JsonSchema = jsonSchema,
    Model = "${configValues.model}",
    ImageResolutionDpi = ${configValues.image_resolution_dpi},${configValues.n_consensus && configValues.n_consensus > 1 ? `\n    NConsensus = ${configValues.n_consensus},` : ""}
});

Console.WriteLine($"Extraction: {extraction.Id}");
`;
};

export const generateRubyCode = (
  currentSchema: Record<string, any>,
  configValues: DocumentExtractRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  return `require 'json'
require 'retab'

client = Retab::Client.new(api_key: ${JSON.stringify(apiKey)})
json_schema = JSON.parse(${rubyJsonLiteral(currentSchema)})

extraction = client.extractions.create(
  document: 'path/to/your/file',
  json_schema: json_schema,
  model: ${JSON.stringify(configValues.model)},
  image_resolution_dpi: ${configValues.image_resolution_dpi},${configValues.n_consensus && configValues.n_consensus > 1 ? `\n  n_consensus: ${configValues.n_consensus},` : ""}
)

puts extraction.output
`;
};

export const generateRustCode = (
  currentSchema: Record<string, any>,
  configValues: DocumentExtractRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  return `use retab::{resources::extractions, Retab};
use std::collections::HashMap;

let client = Retab::new(${rustStringLiteral(apiKey)});
let json_schema: HashMap<String, serde_json::Value> = serde_json::from_str(${rustRawJsonLiteral(currentSchema)})?;

let mut params = extractions::CreateParams::new("path/to/your/file.pdf", json_schema);
params.body.model = Some(${rustStringLiteral(configValues.model)}.to_string());
params.body.image_resolution_dpi = Some(${configValues.image_resolution_dpi});
${configValues.n_consensus && configValues.n_consensus > 1 ? `params.body.n_consensus = Some(${configValues.n_consensus});\n` : ""}let _extraction = client.extractions().create(params).await?;

println!("Extraction completed");
`;
};

export const generateJavaCode = (
  currentSchema: Record<string, any>,
  configValues: DocumentExtractRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  return javaMainSnippet(
    [
      "import com.fasterxml.jackson.core.type.TypeReference;",
      "import com.fasterxml.jackson.databind.ObjectMapper;",
      "import com.retab.RetabClient;",
      "import com.retab.models.Extraction;",
      "import java.util.Map;",
    ],
    `
RetabClient client = new RetabClient(${javaStringLiteral(apiKey)});
ObjectMapper objectMapper = new ObjectMapper();
Map<String, Object> jsonSchema = objectMapper.readValue(
    ${javaStringLiteral(JSON.stringify(currentSchema, null, 2))},
    new TypeReference<Map<String, Object>>() {});

Extraction extraction = client.extractions().create(
    "path/to/your/file.pdf",
    jsonSchema,
    ${javaStringLiteral(configValues.model)},
    ${configValues.image_resolution_dpi}L,
    null,
    ${configValues.n_consensus && configValues.n_consensus > 1 ? `${configValues.n_consensus}L` : "null"},
    null,
    null,
    null,
    false,
    null,
    null);

System.out.println("Extraction completed: " + extraction);
`,
  );
};

// Function to generate cURL code
export const generateCurlCode = (
  currentSchema: Record<string, any>,
  configValues: DocumentExtractRequest,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const jsonPayload: Record<string, any> = {
    document: {
      filename: "your-document.pdf",
      url: "data:application/pdf;base64,<BASE64_ENCODED_FILE_CONTENT>",
    },
    json_schema: currentSchema,
    model: configValues.model,
    image_resolution_dpi: configValues.image_resolution_dpi,
  };

  if (configValues.n_consensus && configValues.n_consensus > 1) {
    jsonPayload.n_consensus = configValues.n_consensus;
  }

  const backendUrl =
    typeof window !== "undefined" &&
    window.location?.origin?.includes("localhost")
      ? "http://localhost:8000"
      : "https://api.retab.com";

  return `curl -X POST "${backendUrl}/v1/extractions" \\
  -H "Content-Type: application/json" \\
  -H "Api-Key: ${apiKey}" \\
  -d '${JSON.stringify(jsonPayload, null, 2)}'

# To encode your file as base64:
# base64 -i your-document.pdf`;
};

interface CodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSchema: Record<string, any>;
  configValues: DocumentExtractRequest;
}

const CodeDialog = ({
  open,
  onOpenChange,
  currentSchema,
  configValues,
}: CodeDialogProps) => {
  // Generate code with the current schema and config values
  const generatePythonRetabCodeWithActualVariables = () => {
    return generatePythonRetabCode(currentSchema, configValues);
  };

  const generateTypeScriptRetabCodeWithActualVariables = () => {
    return generateTypeScriptRetabCode(currentSchema, configValues);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          // Force cleanup on close
          setTimeout(() => onOpenChange(false), 0);
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="flex max-h-[95vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Code Snippets</DialogTitle>
          <DialogDescription>
            Use this code to run the extraction with your current configuration
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="retab_api" className="h-full w-full">
          <TabsList>
            <TabsTrigger value="retab_api">Python</TabsTrigger>
            <TabsTrigger value="typescript_api">TypeScript</TabsTrigger>
          </TabsList>
          <TabsContent value="retab_api" className="space-y-4">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="bg-background/80 absolute top-2 right-2 z-10 h-8 w-8 p-0 backdrop-blur-sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    generatePythonRetabCodeWithActualVariables(),
                  );
                  toast.success("Code has been copied to your clipboard");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <SyntaxHighlighter
                language="python"
                style={oneLight}
                Numbers
                wrapLines
                lineProps={{ style: { background: "white" } }}
                wrapLongLines
                customStyle={{
                  backgroundColor: "white",
                  fontSize: "12px",
                  maxHeight: "580px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              >
                {generatePythonRetabCodeWithActualVariables()}
              </SyntaxHighlighter>
            </div>
            <DialogFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    generatePythonRetabCodeWithActualVariables(),
                  );
                  toast.success("Code has been copied to your clipboard");
                }}
              >
                Copy to Clipboard
              </Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="typescript_api" className="space-y-4">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="bg-background/80 absolute top-2 right-2 z-10 h-8 w-8 p-0 backdrop-blur-sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    generateTypeScriptRetabCodeWithActualVariables(),
                  );
                  toast.success("Code has been copied to your clipboard");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <SyntaxHighlighter
                language="typescript"
                style={oneLight}
                wrapLines
                lineProps={{ style: { background: "white" } }}
                wrapLongLines
                customStyle={{
                  backgroundColor: "white",
                  fontSize: "12px",
                  maxHeight: "580px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              >
                {generateTypeScriptRetabCodeWithActualVariables()}
              </SyntaxHighlighter>
            </div>
            <DialogFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    generateTypeScriptRetabCodeWithActualVariables(),
                  );
                  toast.success("Code has been copied to your clipboard");
                }}
              >
                Copy to Clipboard
              </Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CodeDialog;
