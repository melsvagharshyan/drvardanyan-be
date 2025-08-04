import { Schema, Document } from 'mongoose';

export interface Feedback extends Document {
  fullName: string;
  recommendation: string;
  stars: number;
  image?: {
    public_id: string;
    url: string;
  } & string;
  approved: boolean;
}

export const FeedbackSchema = new Schema({
  fullName: { type: String, required: true },
  recommendation: { type: String, required: true },
  stars: { type: Number, required: true },
  image: {
    public_id: { type: String, required: false },
    url: { type: String, required: false },
  },
  approved: { type: Boolean, default: false },
});
