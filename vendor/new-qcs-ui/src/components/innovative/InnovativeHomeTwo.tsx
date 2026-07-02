import React from "react";
import Image from "next/image";
import image from "@/assets/img/Images/growth.png";


interface DataType {
	title_1: string;
	des_1: string;
	title_2: string;
	des_2: string;
	features: {
		id: number;
		title: string;
		des: string;
	}[];
}



interface Props {
  data: DataType;   // 👈 koi bhi data aa sakta hai
  image: any;
}
const InnovativeHomeTwo = ({ data, image }: Props) => {
	 const { title_1, des_1, title_2, des_2, features } = data;
	return (
		<>
			<div className="cs_height_150 cs_height_lg_60"></div>
			<section>
				<div className="container">
					<div className="cs_modern_needs cs_style">
						<div className="cs_col_md_778">
							<div className="cs_text">
								<div className="cs_section_heading cs_style_1">
									<div className="cs_section_heading_text">
										{/* <h2 className="cs_section_title anim_heading_title">
											{title_1}
										</h2> */}
										<h2
											className="cs_section_title anim_heading_title"
											dangerouslySetInnerHTML={{ __html: title_1 }}
										></h2>
									</div>
								</div>
								<div className="cs_height_65"></div>
								<p className="anim_text">{des_1}</p>
							</div>
							<div className="cs_height_85"></div>
							<div className="row anim_div_ShowLeftSide">
								{features.map((item, i) => (
									<div className="col-md-4 col-12" key={i}>
										<div className="cs_stroke_text">
											<span>{item.id}</span>
										</div>
										<div className="text-section">
											<h6>{item.title}</h6>
											<p>{item.des}</p>
										</div>
									</div>
								))}
							</div>
						</div>
						<div className="cs_col_md_672">
							<div className="cs_img_section">
								<Image src={image} alt="modern_digital_pipeline" />
								<div className="cs_img_card_text anim_div_ShowZoom">
									<h6 className="cs_color_style">{title_2}</h6>
									<p>{des_2}</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</>
	);
};

export default InnovativeHomeTwo;
