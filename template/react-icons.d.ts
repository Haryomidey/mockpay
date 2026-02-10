import "react-icons";
import type * as React from "react";

declare module "react-icons" {
  interface IconBaseProps extends React.SVGAttributes<SVGElement> {
    className?: string;
  }
}
