import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { handleDeleteImage, handleUpload } from 'src/cloud/cloudinary';
import { Feedback } from 'src/schemas/feedback.schema';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel('Feedback')
    private feedbackModel: Model<Feedback>,
  ) {}

  async createFeedback(
    data: Partial<Feedback>,
  ): Promise<Feedback> {
    let image = {
      public_id: '',
      url: '',
    };

    if (data?.image) {
      const result = await handleUpload(data?.image);
      image = {
        public_id: result.public_id,
        url: result.url,
      };
    }

    const newFeedback = new this.feedbackModel({ ...data, image });

    const newData = await newFeedback.save();
    return newData;
  }

  async getAllFeedbacks(): Promise<Feedback[]> {
    return await this.feedbackModel.find().exec();
  }

  async approve(_id: string): Promise<Feedback | null> {
    return this.feedbackModel.findByIdAndUpdate(
      _id,
      { approved: true },
      { new: true },
    );
  }

  async findAllApproved(): Promise<Feedback[]> {
    return this.feedbackModel.find({ approved: true });
  }

  async deleteFeedbackById(_id: string): Promise<{ deleted: boolean }> {
    const item = await this.feedbackModel.findById(_id);

    const imageId = item?.image?.public_id || '';

    if (imageId) {
      await handleDeleteImage(imageId);
    }

    const result = await this.feedbackModel.deleteOne({ _id });

    return { deleted: result.deletedCount > 0 };
  }
} 