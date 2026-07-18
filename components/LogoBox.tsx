import Image from "next/image";

export default function LogoBox({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}) {
  return (
    <div
      className={`relative w-28 md:w-40 aspect-[7/3] rounded-lg overflow-hidden ${className}`}
    >
      <Image src={src} alt="SpaceSnap" fill className="object-cover" />
    </div>
  );
}
