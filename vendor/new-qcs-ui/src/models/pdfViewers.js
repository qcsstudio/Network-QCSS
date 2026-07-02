import mongoose from "mongoose";

const emailVerify = new mongoose.Schema({
 name: { type: String, required: true },
  email: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  verifyToken: { type: String },
  pdftype:{type:String,required:true},
  verifyTokenExpiry:{type:String}
},
{
  timestamps:true
});

export default mongoose.models.pdfViewers || mongoose.model("pdfViewers", emailVerify);
