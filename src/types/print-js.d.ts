declare module 'print-js' {
  interface PrintOptions {
    printable: string;
    type?: 'html' | 'pdf' | 'image' | 'raw-html';
    css?: string[];
    style?: string;
    scanStyles?: boolean;
    targetStyles?: string[];
    showModal?: boolean;
    modalMessage?: string;
    documentTitle?: string;
    onPrintDialogClose?: () => void;
    onError?: (error: Error) => void;
  }
  export default function printJS(options: PrintOptions | string): void;
}
