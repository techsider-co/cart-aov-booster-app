import { isRouteErrorResponse, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

function getErrorDetails(error: unknown): { title: string; message: string } {
  if (isRouteErrorResponse(error)) {
    return {
      title: `${error.status} ${error.statusText}`,
      message:
        typeof error.data === "string"
          ? error.data
          : (error.data as { message?: string })?.message ?? error.statusText,
    };
  }

  if (error instanceof Error) {
    return {
      title: "Bir hata oluştu",
      message: error.message,
    };
  }

  return {
    title: "Bir hata oluştu",
    message:
      "Bu sayfa yüklenirken beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.",
  };
}

export function AppRouteErrorBoundary() {
  const error = useRouteError();

  if (error instanceof Response) {
    return boundary.error(error);
  }

  const { title, message } = getErrorDetails(error);

  return (
    <s-page heading="Cart &amp; AOV Booster">
      <s-section>
        <s-banner tone="critical" heading={title}>
          {message}
        </s-banner>
        <s-box paddingBlockStart="base">
          <s-button variant="primary" onClick={() => window.location.reload()}>
            Sayfayı yenile
          </s-button>
        </s-box>
      </s-section>
    </s-page>
  );
}
