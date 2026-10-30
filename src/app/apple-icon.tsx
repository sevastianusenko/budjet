import { ImageResponse } from "next/og";
import { HearthMark } from "@/components/shell/HearthMark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<HearthMark size={180} />, size);
}
