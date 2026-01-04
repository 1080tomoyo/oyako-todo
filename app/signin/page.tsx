import SigninClient from "./SigninClient";

type PageProps = {
  searchParams?: {
    redirectTo?: string;
  };
};

export default function Page({ searchParams }: PageProps) {
  const redirectTo =
    typeof searchParams?.redirectTo === "string"
      ? searchParams.redirectTo
      : null;

  return <SigninClient redirectTo={redirectTo} />;
}
