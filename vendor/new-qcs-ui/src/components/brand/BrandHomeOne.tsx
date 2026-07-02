
import Image, { StaticImageData } from 'next/image';
import Marquee from "react-fast-marquee";


type DataType = StaticImageData[];
import brand_img_1 from "@/assets/img/Images/accountsely.png"
import brand_img_2 from "@/assets/img/Images/EAA.png"
import brand_img_3 from "@/assets/img/Images/etisha.png"
import brand_img_4 from "@/assets/img/Images/pickleball.png"
import brand_img_5 from "@/assets/img/Images/shilpa.png"
import brand_img_6 from "@/assets/img/Images/udaycrafts.png"

const brand_data: DataType = [
  brand_img_1,
  brand_img_2,
  brand_img_3,
  brand_img_4,
  brand_img_5,
  brand_img_6,
  brand_img_1,
  brand_img_2,
  brand_img_3,
  brand_img_4,
  brand_img_5,
  brand_img_6,
  brand_img_1,
  brand_img_2,
  brand_img_3,
  brand_img_4,
  brand_img_5,
  brand_img_6,


]



const BrandHomeOne = ({ style_2 }: any) => {
  return (
    <> 
      
      {style_2 ?
        <>
          <div className="cs_height_150 cs_height_lg_60"></div>
          <p className="text-center cs_font_18 cs_normal">
            130+ Our Client & Partner We Are Working Together
          </p>
          <div className="cs_height_100 cs_height_lg_60"></div>
        </>
        :
        <div className="cs_height_140 cs_height_lg_70"></div>
      }

  <Marquee
  speed={60}
  pauseOnHover
  gradient={false}   // 🔥 important (no fade gaps)
>
  {brand_data.map((img, index) => (
    <div className="brand-marquee-item" key={index}>
      <Image
        src={img}
        alt="brand-image"
        width={210}
        height={146}
        style={{ objectFit: "contain" }}
      />
    </div>
  ))}
</Marquee>
    
      <div className="cs_height_140 cs_height_lg_70"></div>
    </>
  );
};

export default BrandHomeOne;