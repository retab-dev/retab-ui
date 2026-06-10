"use client";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-retab/dialog";
import { useJsonSchema } from "@/components/schema-editor/contexts/json-schema";
import { Card, CardContent, CardHeader } from "@/components/ui-retab/card";
import {
  templateCategories,
  getFullTemplate,
  FullTemplate,
  Template,
} from "@/components/schema-editor/config";
import { Badge } from "@/components/ui-retab/badge";

export interface TemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateSelect?: (template: FullTemplate) => void;
}

export function TemplatesDialog({
  open,
  onOpenChange,
  onTemplateSelect,
}: TemplatesDialogProps) {
  // Handle dialog close
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onOpenChange(false);
    }
  };

  const { setJsonSchema } = useJsonSchema();

  // Function to apply a template
  const handleApplyTemplate = (template: FullTemplate) => {
    setJsonSchema(template.json_schema);
    onOpenChange(false);

    // Call the onTemplateSelect callback if provided
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle>Templates</DialogTitle>
          <DialogDescription className="sr-only">
            Select a template to load its form fields
          </DialogDescription>
        </DialogHeader>
        <TemplateCards handleApplyTemplate={handleApplyTemplate} />
      </DialogContent>
    </Dialog>
  );
}

// Create a reusable TemplateCard component
export interface TemplateCardProps {
  category: {
    name: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    templates: Template[];
  };
  onTemplateClick: (template: Template) => void;
}

export const TemplateCard = ({
  category,
  onTemplateClick,
}: TemplateCardProps) => {
  const IconComponent = category.icon;

  return (
    <Card className="hover:border-primary h-56 w-72 gap-0 shadow-none transition-colors">
      <CardHeader className="mb-0 pb-2">
        <IconComponent />
        <h3 className="text-lg font-medium">{category.name}</h3>
      </CardHeader>
      <CardContent className="mt-0">
        <div className="mt-2 flex flex-wrap gap-2">
          {category.templates.map((template) => (
            <Badge
              key={template.id}
              variant="secondary"
              className="hover:bg-primary hover:text-primary-foreground cursor-pointer rounded-full"
              onClick={() => onTemplateClick(template)}
            >
              <span className="px-1">{template.name}</span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Create a TemplateCards component that uses the TemplateCard
export const TemplateCards = ({
  handleApplyTemplate,
}: {
  handleApplyTemplate: (template: FullTemplate) => void;
}) => {
  const handleBadgeClick = (template: Template) => {
    // Get the full template with json_schema from local data
    const fullTemplate = getFullTemplate(template);
    handleApplyTemplate(fullTemplate);
  };

  return (
    <div className="flex flex-wrap gap-4">
      {templateCategories.map((category) => (
        <TemplateCard
          key={category.name}
          category={category}
          onTemplateClick={handleBadgeClick}
        />
      ))}
    </div>
  );
};
