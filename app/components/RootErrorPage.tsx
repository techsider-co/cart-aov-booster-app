import { isRouteErrorResponse } from "react-router";

interface RootErrorPageProps {
  error: unknown;
}

export function RootErrorPage({ error }: RootErrorPageProps) {
  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "Beklenmeyen bir hata oluştu";

  const message = isRouteErrorResponse(error)
    ? error.data?.message ?? error.statusText
    : error instanceof Error
      ? error.message
      : "Uygulama yüklenirken bir sorun oluştu. Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.";

  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{title} — Cart &amp; AOV Booster</title>
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              *, *::before, *::after { box-sizing: border-box; }
              body {
                margin: 0;
                min-height: 100vh;
                font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                background: #f6f6f7;
                color: #202223;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
              }
              .error-card {
                max-width: 480px;
                width: 100%;
                background: #fff;
                border: 1px solid #e1e3e5;
                border-radius: 12px;
                padding: 32px;
                box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
              }
              .error-icon {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: #fef3f2;
                color: #d72c0d;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                margin-bottom: 16px;
              }
              h1 {
                margin: 0 0 8px;
                font-size: 20px;
                font-weight: 600;
                line-height: 1.4;
              }
              p {
                margin: 0 0 24px;
                font-size: 14px;
                line-height: 1.5;
                color: #6d7175;
              }
              button {
                appearance: none;
                border: none;
                border-radius: 8px;
                background: #303030;
                color: #fff;
                font-size: 14px;
                font-weight: 500;
                padding: 8px 16px;
                cursor: pointer;
              }
              button:hover { background: #1a1a1a; }
            `,
          }}
        />
      </head>
      <body>
        <div className="error-card">
          <div className="error-icon" aria-hidden="true">
            !
          </div>
          <h1>{title}</h1>
          <p>{message}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Sayfayı yenile
          </button>
        </div>
      </body>
    </html>
  );
}
