import { useEffect, useRef } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

interface ActionToastOptions<T> {
  data: T | undefined;
  isSuccess: (data: T) => boolean;
  successMessage: string;
  errorMessage?: string;
  getErrorMessage?: (data: T) => string | undefined;
}

export function useActionToast<T>({
  data,
  isSuccess,
  successMessage,
  errorMessage = "Kayıt sırasında bir hata oluştu.",
  getErrorMessage,
}: ActionToastOptions<T>) {
  const shopify = useAppBridge();
  const lastDataRef = useRef<T | undefined>(undefined);

  useEffect(() => {
    if (!data || data === lastDataRef.current) {
      return;
    }

    lastDataRef.current = data;

    if (isSuccess(data)) {
      shopify.toast.show(successMessage);
      return;
    }

    const customError = getErrorMessage?.(data);
    shopify.toast.show(customError ?? errorMessage, { isError: true });
  }, [data, errorMessage, getErrorMessage, isSuccess, shopify, successMessage]);
}
