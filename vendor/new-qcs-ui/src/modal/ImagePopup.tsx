 
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";


interface ImagePopupProps {
  images: string[];
  setIsOpen: (open: boolean) => void;
  photoIndex: number;
  setPhotoIndex: (index: number) => void;
}

export default function ImagePopup({
  images,
  setIsOpen,
  photoIndex,
  setPhotoIndex,
}: ImagePopupProps) {
  return (
    <Lightbox
      open={true}
      index={photoIndex}
      close={() => setIsOpen(false)}
      slides={images.map((src) => ({ src }))}
      on={{ 
        view: ({ index }: { index: number }) => setPhotoIndex(index),
      }}
    />
  );
}

 