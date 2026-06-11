"use client";

import { Type, Hash, ToggleLeft, List, Braces, Brackets, Calendar, Clock, CalendarClock, Link, Shapes, MapPin, DollarSign, User, Building2, CalendarDays } from "lucide-react";

// Get icon for data type
export const getTypeIcon = (type: string) => {
  switch (type) {
    case "string":
      return <Type className="h-4 w-4" />;
    case "number":
    case "integer":
      return <Hash className="h-4 w-4" />;
    case "boolean":
      return <ToggleLeft className="h-4 w-4" />;
    case "enum":
      return <List className="h-4 w-4" />;
    case "object":
      return <Braces className="h-4 w-4" />;
    case "array":
      return <Brackets className="h-4 w-4" />;
    case "date":
      return <Calendar className="h-4 w-4" />;
    case "time":
      return <Clock className="h-4 w-4" />;
    case "datetime":
      return <CalendarClock className="h-4 w-4" />;
    case "$ref":
      return <Link className="h-4 w-4" />;
    default:
      return <Shapes className="h-4 w-4" />;
  }
};

// Get icon for template objects
export const getTemplateIcon = (templateName: string) => {
  switch (templateName) {
    case "Address":
      return <MapPin className="h-4 w-4" />;
    case "Price":
      return <DollarSign className="h-4 w-4" />;
    case "Person":
      return <User className="h-4 w-4" />;
    case "Company":
      return <Building2 className="h-4 w-4" />;
    case "Event":
      return <CalendarDays className="h-4 w-4" />;
    default:
      return <Link className="h-4 w-4" />;
  }
};
