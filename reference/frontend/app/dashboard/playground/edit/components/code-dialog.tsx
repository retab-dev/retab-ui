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
import {
  goStringLiteral,
  javaMainSnippet,
  javaStringLiteral,
  phpStringLiteral,
  rustStringLiteral,
} from "@/app/dashboard/playground/components/snippet-literals";

export interface EditConfigValues {
  model: string;
  template_id?: string;
  instructions?: string;
}

export interface TemplateConfigValues {
  model: string;
  template_id: string;
  instructions?: string;
}

// Function to generate Python SDK code for Edit API
export const generatePythonCode = (
  configValues: EditConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  if (configValues.template_id) {
    // Template-based edit using the resource-oriented edits.create() method.
    return `import base64
from retab import Retab

api_key = "${apiKey}"

client = Retab(api_key=api_key)

# Fill the form using a saved template
edit = client.edits.create(
    template_id="${configValues.template_id}",
    instructions="# Enter your filling instructions here",
    model="${configValues.model}",
)

# Save the filled PDF (MIMEData with data URI)
# Extract base64 content from data URI
base64_content = edit.output.filled_document.url.split(",")[1]
filled_document_bytes = base64.b64decode(base64_content)
with open("filled_form.pdf", "wb") as f:
    f.write(filled_document_bytes)

# Access form data with filled values
print(f"Filled {len(edit.output.form_data)} form fields")
for field in edit.output.form_data:
    if field.value:
        print(f"Field: {field.description} = {field.value}")
`;
  }

  // Document-based edit (no template) using edits.create()
  return `import base64
from retab import Retab

api_key = "${apiKey}"

client = Retab(api_key=api_key)

# Edit the form using AI agent to detect and fill fields
# The SDK accepts file paths directly
edit = client.edits.create(
    document="form.pdf",
    instructions=${JSON.stringify(configValues.instructions)},
    model="${configValues.model}",
)

# Save the filled document (MIMEData with data URI)
# Extract base64 content from data URI
base64_content = edit.output.filled_document.url.split(",")[1]
filled_document_bytes = base64.b64decode(base64_content)
with open("filled_form.pdf", "wb") as f:
    f.write(filled_document_bytes)

# Access form data with filled values
print(f"Filled {len(edit.output.form_data)} form fields")
for field in edit.output.form_data:
    if field.value:
        print(f"Field: {field.description} = {field.value}")
`;
};

// Function to generate TypeScript SDK code for Edit API
export const generateTypeScriptCode = (
  configValues: EditConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  if (configValues.template_id) {
    // Template-based edit using the resource-oriented edits.create() method.
    return `import { Retab, type Edit } from '@retab/node';
import { writeFileSync } from 'fs';

const apiKey = "${apiKey}";

const client = new Retab({ apiKey });

// Fill the form using a saved template
const edit: Edit = await client.edits.create(
    ${JSON.stringify(configValues.instructions)},
    undefined,
    "${configValues.template_id}",
    "${configValues.model}"
);

// Save the filled PDF (MIMEData with data URI)
const base64Content = edit.output.filledDocument.url.split(",")[1];
const filledPdfBuffer = Buffer.from(base64Content, 'base64');
writeFileSync("filled_form.pdf", filledPdfBuffer);

// Access form data with filled values
console.log(\`Filled \${edit.output.formData.length} form fields\`);
edit.output.formData.forEach(field => {
    if (field.value) {
        console.log(\`Field: \${field.description} = \${field.value}\`);
    }
});
`;
  }

  // Document-based edit (no template) using edits.create()
  return `import { Retab, type Edit } from '@retab/node';
import { readFileSync, writeFileSync } from 'fs';

const apiKey = "${apiKey}";

const client = new Retab({ apiKey });

// Read and encode document as MIMEData
const docBuffer = readFileSync("form.pdf");
const docBase64 = docBuffer.toString('base64');

// Edit the document using AI agent to detect and fill fields
const edit: Edit = await client.edits.create(
    ${JSON.stringify(configValues.instructions)},
    {
        filename: "form.pdf",
        url: \`data:application/pdf;base64,\${docBase64}\`
    },
    undefined,
    "${configValues.model}"
);

// Save the filled document (MIMEData with data URI)
const base64Content = edit.output.filledDocument.url.split(",")[1];
const filledBuffer = Buffer.from(base64Content, 'base64');
writeFileSync("filled_form.pdf", filledBuffer);

// Access form data with filled values
console.log(\`Filled \${edit.output.formData.length} form fields\`);
edit.output.formData.forEach(field => {
    if (field.value) {
        console.log(\`Field: \${field.description} = \${field.value}\`);
    }
});
`;
};

export const generateGoCode = (
  configValues: EditConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const instructions =
    configValues.instructions || "Enter your filling instructions here";
  const templateLine = configValues.template_id
    ? `templateID := ${goStringLiteral(configValues.template_id)}\n`
    : "";
  const templateField = configValues.template_id
    ? "\n    TemplateID: &templateID,"
    : "";

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

model := ${goStringLiteral(configValues.model)}
${templateLine}edit, err := client.Edits.Create(ctx, &retab.EditsCreateParams{
    Document: "form.pdf",
    Instructions: ${goStringLiteral(instructions)},
    Model: &model,${templateField}
})
if err != nil {
    panic(err)
}

fmt.Println("Filled document:", edit.Output.FilledDocument.URL)
fmt.Println("Field count:", len(edit.Output.FormData))
`;
};

export const generatePhpCode = (
  configValues: EditConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const instructions =
    configValues.instructions || "Enter your filling instructions here";
  const templateLine = configValues.template_id
    ? `\n    templateId: ${phpStringLiteral(configValues.template_id)},`
    : "";

  return `<?php
require 'vendor/autoload.php';

use Retab\\Client;

$client = new Client(apiKey: ${phpStringLiteral(apiKey)});

$edit = $client->edits()->create(
    document: 'form.pdf',${templateLine}
    instructions: ${phpStringLiteral(instructions)},
    model: ${phpStringLiteral(configValues.model)},
);

echo 'Filled document: ' . $edit->output->filled_document->url . PHP_EOL;
echo 'Field count: ' . count($edit->output->form_data) . PHP_EOL;
`;
};

export const generateDotnetCode = (
  configValues: EditConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const instructions =
    configValues.instructions || "Enter your filling instructions here";
  const templateLine = configValues.template_id
    ? `\n    TemplateId = "${configValues.template_id}",`
    : "";

  return `using Retab;
using RetabClient = Retab.Retab;

var client = new RetabClient("${apiKey}");

var edit = await client.Edits.CreateAsync(new EditsCreateOptions
{
    Document = MimeData.FromFile("form.pdf"),${templateLine}
    Instructions = ${JSON.stringify(instructions)},
    Model = "${configValues.model}",
});

Console.WriteLine($"Filled document: {edit.Output.FilledDocument.Url}");
Console.WriteLine($"Field count: {edit.Output.FormData.Count}");
`;
};

export const generateRubyCode = (
  configValues: EditConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const instructions =
    configValues.instructions || "Enter your filling instructions here";
  const templateLine = configValues.template_id
    ? `\n  template_id: ${JSON.stringify(configValues.template_id)},`
    : "";

  return `require 'retab'

client = Retab::Client.new(api_key: ${JSON.stringify(apiKey)})

edit = client.edits.create(
  document: 'form.pdf',${templateLine}
  instructions: ${JSON.stringify(instructions)},
  model: ${JSON.stringify(configValues.model)},
)

puts "Filled document: #{edit.output.filled_document.url}"
puts "Field count: #{edit.output.form_data.length}"
`;
};

export const generateRustCode = (
  configValues: EditConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const instructions =
    configValues.instructions || "Enter your filling instructions here";
  const templateLine = configValues.template_id
    ? `params.body.template_id = Some(${rustStringLiteral(configValues.template_id)}.to_string());\n`
    : `params.body.document = Some(retab::models::ClassificationRequestDocumentOneOf::from(retab::MimeData::from("form.pdf")));\n`;

  return `use retab::{resources::edits, Retab};

let client = Retab::new(${rustStringLiteral(apiKey)});
let mut params = edits::CreateParams::new(${rustStringLiteral(instructions)});
${templateLine}params.body.model = Some(${rustStringLiteral(configValues.model)}.to_string());

let _edit = client.edits().create(params).await?;

println!("Edit completed");
`;
};

export const generateJavaCode = (
  configValues: EditConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const instructions =
    configValues.instructions || "Enter your filling instructions here";

  return javaMainSnippet(
    ["import com.retab.RetabClient;", "import com.retab.models.Edit;"],
    `
RetabClient client = new RetabClient(${javaStringLiteral(apiKey)});
Edit edit = client.edits().create(
    ${javaStringLiteral(instructions)},
    ${configValues.template_id ? "null" : javaStringLiteral("form.pdf")},
    ${configValues.template_id ? javaStringLiteral(configValues.template_id) : "null"},
    ${javaStringLiteral(configValues.model)},
    null,
    false,
    false);

System.out.println("Edit completed: " + edit);
`,
  );
};

// Function to generate cURL request for Edit API
export const generateCurlCode = (
  configValues: EditConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  // Use the current backend URL or fallback to production URL
  const backendUrl =
    typeof window !== "undefined" &&
    window.location?.origin?.includes("localhost")
      ? "http://localhost:8000"
      : "https://api.retab.com";

  if (configValues.template_id) {
    // Template-based edit via resource-oriented /v1/edits.
    const jsonPayload = {
      template_id: configValues.template_id,
      instructions: configValues.instructions,
      model: configValues.model,
    };

    return `curl -X POST "${backendUrl}/v1/edits" \\
  -H "Content-Type: application/json" \\
  -H "Api-Key: ${apiKey}" \\
  -d '${JSON.stringify(jsonPayload, null, 2)}'

# The response is an Edit resource:
# - data.form_data: list of form fields with filled values
# - data.filled_document: the filled PDF as MIMEData (filename + data URI)`;
  }

  // Document-based edit (no template) via resource-oriented /v1/edits.
  const jsonPayload = {
    document: {
      filename: "form.pdf",
      url: "data:application/pdf;base64,JVBERi0xLjQK...<BASE64_ENCODED_PDF>",
    },
    instructions: configValues.instructions,
    model: configValues.model,
  };

  return `curl -X POST "${backendUrl}/v1/edits" \\
  -H "Content-Type: application/json" \\
  -H "Api-Key: ${apiKey}" \\
  -d '${JSON.stringify(jsonPayload, null, 2)}'

# To encode your document as base64 data URI:
# echo "data:application/pdf;base64,$(base64 -i form.pdf)"

# The response is an Edit resource:
# - data.form_data: list of form fields with filled values
# - data.filled_document: the filled document as MIMEData (filename + data URI)`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Template-specific code generation (always shows template code)
// ═══════════════════════════════════════════════════════════════════════════════

export const generateTemplatePythonCode = (
  configValues: TemplateConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const templateId = configValues.template_id || "YOUR_TEMPLATE_ID";
  return `import base64
from retab import Retab

api_key = "${apiKey}"

client = Retab(api_key=api_key)

# Fill the form using a saved template
edit = client.edits.create(
    template_id="${templateId}",
    instructions=${JSON.stringify(configValues.instructions || "Enter your filling instructions here")},
    model="${configValues.model}",
)

# Save the filled PDF (MIMEData with data URI)
# Extract base64 content from data URI
base64_content = edit.output.filled_document.url.split(",")[1]
filled_document_bytes = base64.b64decode(base64_content)
with open("filled_form.pdf", "wb") as f:
    f.write(filled_document_bytes)

# Access form data with filled values
print(f"Filled {len(edit.output.form_data)} form fields")
for field in edit.output.form_data:
    if field.value:
        print(f"Field: {field.description} = {field.value}")
`;
};

export const generateTemplateTypeScriptCode = (
  configValues: TemplateConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const templateId = configValues.template_id || "YOUR_TEMPLATE_ID";
  return `import { Retab, type Edit } from '@retab/node';
import { writeFileSync } from 'fs';

const apiKey = "${apiKey}";

const client = new Retab({ apiKey });

// Fill the form using a saved template
const edit: Edit = await client.edits.create({
    template_id: "${templateId}",
    instructions: ${JSON.stringify(configValues.instructions || "Enter your filling instructions here")},
    model: "${configValues.model}",
});

// Save the filled PDF (MIMEData with data URI)
const base64Content = edit.output.filled_document.url.split(",")[1];
const filledPdfBuffer = Buffer.from(base64Content, 'base64');
writeFileSync("filled_form.pdf", filledPdfBuffer);

// Access form data with filled values
console.log(\`Filled \${edit.output.form_data.length} form fields\`);
edit.output.form_data.forEach(field => {
    if (field.value) {
        console.log(\`Field: \${field.description} = \${field.value}\`);
    }
});
`;
};

export const generateTemplateCurlCode = (
  configValues: TemplateConfigValues,
  apiKey: string = "YOUR_RETAB_API_KEY",
) => {
  const backendUrl =
    typeof window !== "undefined" &&
    window.location?.origin?.includes("localhost")
      ? "http://localhost:8000"
      : "https://api.retab.com";

  const templateId = configValues.template_id || "YOUR_TEMPLATE_ID";
  const jsonPayload = {
    template_id: templateId,
    instructions:
      configValues.instructions || "Enter your filling instructions here",
    model: configValues.model,
  };

  return `curl -X POST "${backendUrl}/v1/edits" \\
  -H "Content-Type: application/json" \\
  -H "Api-Key: ${apiKey}" \\
  -d '${JSON.stringify(jsonPayload, null, 2)}'

# The response is an Edit resource:
# - data.form_data: list of form fields with filled values
# - data.filled_document: the filled PDF as MIMEData (filename + data URI)`;
};

interface CodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configValues: EditConfigValues;
}

const CodeDialog = ({ open, onOpenChange, configValues }: CodeDialogProps) => {
  const generatePythonCodeWithActualVariables = () => {
    return generatePythonCode(configValues);
  };

  const generateTypeScriptCodeWithActualVariables = () => {
    return generateTypeScriptCode(configValues);
  };

  const generateCurlCodeWithActualVariables = () => {
    return generateCurlCode(configValues);
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
          <DialogTitle>Code Examples</DialogTitle>
          <DialogDescription>
            Use this code to edit forms with your current configuration
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="python" className="h-full w-full">
          <TabsList>
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="typescript">TypeScript</TabsTrigger>
            <TabsTrigger value="curl">cURL</TabsTrigger>
          </TabsList>
          <TabsContent value="python" className="space-y-4">
            <div className="relative">
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
                  maxHeight: "580px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              >
                {generatePythonCodeWithActualVariables()}
              </SyntaxHighlighter>
            </div>
            <DialogFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    generatePythonCodeWithActualVariables(),
                  );
                  toast.success("Code has been copied to your clipboard");
                }}
              >
                Copy to Clipboard
              </Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="typescript" className="space-y-4">
            <div className="relative">
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
                  maxHeight: "580px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              >
                {generateTypeScriptCodeWithActualVariables()}
              </SyntaxHighlighter>
            </div>
            <DialogFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    generateTypeScriptCodeWithActualVariables(),
                  );
                  toast.success("Code has been copied to your clipboard");
                }}
              >
                Copy to Clipboard
              </Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="curl" className="space-y-4">
            <div className="relative">
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
                  maxHeight: "580px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              >
                {generateCurlCodeWithActualVariables()}
              </SyntaxHighlighter>
            </div>
            <DialogFooter className="flex justify-between">
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CodeDialog;
