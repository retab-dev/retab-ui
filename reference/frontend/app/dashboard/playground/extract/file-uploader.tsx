import { useState, useRef } from "react";
import { toast } from "sonner";
import { CloudUpload, Paperclip, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
export const FileUploader = ({
  onFileUploaded,
  multiple = false,
  className,
}: {
  onFileUploaded: (file: File, buffer: ArrayBuffer) => void;
  multiple?: boolean;
  className?: string;
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // This handles the actual file processing
  const processFile = async (file: File) => {
    try {
      setIsUploading(true);
      const buffer = await file.arrayBuffer();
      onFileUploaded(file, buffer);

      toast.success("File loaded successfully");
    } catch (error) {
      console.error("Error loading file:", error);
      toast.error("Failed to load file");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle the change event from the file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      processFile(file);
    }
  };

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      processFile(file);
    }
  };

  return (
    <div
      className={cn(
        `flex h-full w-full cursor-pointer flex-col items-center justify-center bg-gray-100 transition-colors ${
          isDragging ? "bg-blue-50" : ""
        }`,
        className,
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <CloudUpload
        className={`h-12 w-12 ${
          isDragging ? "text-blue-400" : "text-slate-600"
        } transition-colors`}
      />

      <h3 className="mt-4 mb-2 text-2xl font-normal text-slate-800">
        Upload a file
      </h3>

      <p className="text-center text-sm text-slate-700">
        Drag and drop or click to select a file
      </p>
      <input
        multiple={multiple}
        type="file"
        aria-label="Upload a file"
        ref={fileInputRef}
        onChange={handleFileChange}
        disabled={isUploading}
        className="hidden"
        id="file-upload"
      />
    </div>
  );
};
