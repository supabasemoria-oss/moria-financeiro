import * as React from "react";
import { Loader } from "./loader";

export function CornerChase(props: React.ComponentProps<typeof Loader>) {
  return <Loader {...props} variant="corner-chase" />;
}
