import { ImageResponse } from "next/og";
import { HearthMark } from "@/components/shell/HearthMark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<HearthMark size={512} />, size);
}
