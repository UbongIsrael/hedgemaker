import lightLogo from "@/assets/brand/logo/hedgemaker-logo-light.webp";
import darkLogo from "@/assets/brand/logo/hedgemaker-logo-dark.webp";

/** Show the selected original artwork, trimming only its outer whitespace in CSS. */
export function BrandLogo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="brand-art">
      <img
        src={dark ? darkLogo : lightLogo}
        alt="HedgeMaker"
        width="1983"
        height="793"
        loading={dark ? "lazy" : "eager"}
      />
    </span>
  );
}
