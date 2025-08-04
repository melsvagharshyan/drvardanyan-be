import {
  Controller,
  Post,
  Body,
  Get,
  HttpException,
  HttpStatus,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { Feedback } from 'src/schemas/feedback.schema';

@Controller('feedbacks')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async create(@Body() data: Partial<Feedback>) {
    try {
      const created =
        await this.feedbackService.createFeedback(data);

      return { message: 'Created', data: created };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to create feedback',
          error: error.message || error,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get()
  async findAll() {
    try {
      const data = await this.feedbackService.getAllFeedbacks();
      return { data };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to fetch feedbacks',
          error: error.message || error,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':_id/approve')
  async approveFeedback(@Param('_id') id: string) {
    return this.feedbackService.approve(id);
  }

  @Get('approved')
  async getApprovedFeedbacks() {
    return this.feedbackService.findAllApproved();
  }

  @Delete(':_id/delete')
  async delete(@Param('_id') id: string) {
    try {
      const result =
        await this.feedbackService.deleteFeedbackById(id);
      if (!result.deleted) {
        throw new HttpException(
          'Feedback not found',
          HttpStatus.NOT_FOUND,
        );
      }
      return { message: 'Deleted successfully' };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to delete feedback',
          error: error.message || error,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
} 