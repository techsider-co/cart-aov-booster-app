import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { AppRouteErrorBoundary } from "../components/AppRouteErrorBoundary";
import { authenticate } from "../shopify.server";
import { checkProSubscription } from "../services/shop-subscription.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const { isPro } = await checkProSubscription(request, billing, session.shop);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", isPro };
};

export default function App() {
  const { apiKey, isPro } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        {isPro ? (
          <>
            <s-link href="/app/shipping-bar">Shipping Bar</s-link>
            <s-link href="/app/sticky-cart">Sticky Cart</s-link>
          </>
        ) : null}
        <s-link href="/app/billing">Plan</s-link>
      </s-app-nav>
      <Outlet context={{ isPro }} />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return <AppRouteErrorBoundary />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
