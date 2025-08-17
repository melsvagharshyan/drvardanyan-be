import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Appointment, ServiceKey } from './schema/appointment.schema';

const SERVICE_DURATION_MINUTES: Record<ServiceKey, number> = {
  consultation: 15,
  treatment: 45,
  extraction: 45,
  prosthetics: 45,
};

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<Appointment>,
  ) {}

  private getWorkingHours(
    dateUtc: Date,
    tzOffsetMinutes?: number,
  ): { startHour: number; endHour: number } {
    // Derive local day-of-week robustly using a local date pivot (noon) to avoid edge crossing
    const offsetMs = (tzOffsetMinutes ?? 0) * 60000;
    // Create a local date at noon to avoid timezone edge cases
    const localDate = new Date(dateUtc.getTime() - offsetMs);
    const localNoon = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 12, 0, 0);
    const day = localNoon.getDay(); // 0 Sunday - 6 Saturday in client's local zone
    
    // Weekdays (Mon-Fri): 09:00 - 18:00 ; Weekends (Sat-Sun): 09:00 - 13:00
    if (day === 0 || day === 6) {
      return { startHour: 9, endHour: 13 };
    }
    return { startHour: 9, endHour: 18 };
  }

  private generateSlots(
    dateUtc: Date,
    slotMinutes: number,
    durationMinutes: number,
    tzOffsetMinutes?: number,
  ): string[] {
    const { startHour, endHour } = this.getWorkingHours(dateUtc, tzOffsetMinutes);
    const offsetMs = (tzOffsetMinutes ?? 0) * 60000;
    // Compute local midnight expressed in UTC milliseconds
    const localYmd = new Date(dateUtc.getTime() - offsetMs).toISOString().split('T')[0];
    const localMidnightUtcMs = new Date(localYmd + 'T00:00:00.000Z').getTime() + offsetMs;
    const startMs = localMidnightUtcMs + startHour * 60 * 60000;
    const endMs = localMidnightUtcMs + endHour * 60 * 60000;

    const slots: string[] = [];
    for (
      let t = startMs;
      t + durationMinutes * 60000 <= endMs;
      t += slotMinutes * 60000
    ) {
      slots.push(new Date(t).toISOString());
    }
    return slots;
  }

  private async getBusyIntervalsISO(
    dateUtc: Date,
    tzOffsetMinutes?: number,
  ): Promise<{ start: string; end: string }[]> {
    // Compute local day boundaries in UTC
    const offsetMs = (tzOffsetMinutes ?? 0) * 60000;
    const localMidnightUtcMs = new Date(
      new Date(dateUtc.getTime() - offsetMs).toISOString().split('T')[0] + 'T00:00:00.000Z',
    ).getTime() + offsetMs;
    const dayStart = new Date(localMidnightUtcMs);
    const dayEnd = new Date(localMidnightUtcMs + 24 * 60 * 60000 - 1);

    // Fetch any appointment overlapping the local day window
    const appts = await this.appointmentModel
      .find({
        start: { $lt: dayEnd.toISOString() },
        end: { $gt: dayStart.toISOString() },
      })
      .lean();
    return appts.map((a) => ({ start: a.start, end: a.end }));
  }

  async getAvailabilityForDate(
    dateStr: string,
    service?: ServiceKey,
    tzOffsetMinutes?: number,
  ): Promise<{ availableSlots: string[]; busySlots: string[]; workingSlots: string[] }> {
    if (!dateStr) throw new BadRequestException('date is required (YYYY-MM-DD)');
    const date = new Date(dateStr + 'T00:00:00.000Z');
    if (Number.isNaN(date.getTime())) throw new BadRequestException('invalid date');

    // base slot granularity 15 min to match the shortest service
    const slotMinutes = 15;
    const durationMinutes = service
      ? SERVICE_DURATION_MINUTES[service]
      : 45; // default for majority; availability should block any overlap at 15-min resolution

    // Default tz to user's timezone if not provided, or use UTC as fallback
    const effectiveTzOffset =
      typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes)
        ? tzOffsetMinutes
        : 0; // Use UTC if no timezone provided

    const allSlots = this.generateSlots(date, slotMinutes, slotMinutes, effectiveTzOffset);
    const busyIntervals = await this.getBusyIntervalsISO(date, effectiveTzOffset);

    const busySlots = new Set<string>();
    for (const interval of busyIntervals) {
      const s = new Date(interval.start).getTime();
      const e = new Date(interval.end).getTime();
      for (const slot of allSlots) {
        const t = new Date(slot).getTime();
        if (t >= s && t < e) busySlots.add(slot);
      }
    }

    // compute available starts for any service selection runtime on FE
    const serviceSpecificStarts = this.generateSlots(
      date,
      slotMinutes,
      durationMinutes,
      effectiveTzOffset,
    );
    const chunksNeeded = Math.max(1, Math.ceil(durationMinutes / slotMinutes));
    let availableSlots = serviceSpecificStarts.filter((startIso) => {
      const startMs = new Date(startIso).getTime();
      for (let i = 0; i < chunksNeeded; i++) {
        const chunkIso = new Date(startMs + i * slotMinutes * 60000).toISOString();
        if (busySlots.has(chunkIso)) return false;
      }
      return true;
    });

    // If the requested date is "today" for the client's timezone, filter out past times
    {
      const nowMs = Date.now();
      const offsetMs = effectiveTzOffset * 60000;
      const todayClientLocal = new Date(nowMs + offsetMs).toISOString().split('T')[0];
      if (dateStr === todayClientLocal) {
        const thresholdUtcMs = nowMs;
        availableSlots = availableSlots.filter((iso) => new Date(iso).getTime() > thresholdUtcMs);
      }
    }

    return { availableSlots, busySlots: Array.from(busySlots), workingSlots: allSlots };
  }

  async createAppointment(body: {
    name: string;
    phoneNumber: string;
    service: ServiceKey;
    start: string; // ISO
    tzOffset?: number;
  }) {
    const { name, phoneNumber, service, start } = body;
    if (!name || !phoneNumber || !service || !start) {
      throw new BadRequestException('name, phoneNumber, service, start are required');
    }
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) throw new BadRequestException('invalid start');
    const durationMinutes = SERVICE_DURATION_MINUTES[service];
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

    // Check working hours and overlap
    // Enforce working hours in client's local timezone; default to Armenia (UTC+4 → -240) if not provided
    const providedOffset = (body as any).tzOffset;
    const parsedOffset = Number(providedOffset);
    const effectiveTzOffset: number = Number.isFinite(parsedOffset)
      ? parsedOffset
      : 0; // Use UTC if no timezone provided
    const { startHour, endHour } = this.getWorkingHours(startDate, effectiveTzOffset);
    let dayStart: Date;
    let dayEnd: Date;
    const offsetMs = effectiveTzOffset * 60000;
    // derive local date Y-M-D for the appointment start
    const localYmd = new Date(startDate.getTime() - offsetMs)
      .toISOString()
      .split('T')[0];
    // compute local midnight expressed in UTC milliseconds
    const localMidnightUtcMs = new Date(localYmd + 'T00:00:00.000Z').getTime() + offsetMs;
    dayStart = new Date(localMidnightUtcMs + startHour * 60 * 60000);
    dayEnd = new Date(localMidnightUtcMs + endHour * 60 * 60000);
    if (startDate < dayStart || endDate > dayEnd) {
      throw new BadRequestException('Outside working hours');
    }

    const overlapping = await this.appointmentModel.exists({
      start: { $lt: endDate.toISOString() },
      end: { $gt: startDate.toISOString() },
    });
    if (overlapping) throw new BadRequestException('Time slot is busy');

    return this.appointmentModel.create({
      name,
      phoneNumber,
      service,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
  }

  async getAllAppointments() {
    return this.appointmentModel.find().sort({ start: -1 }).lean();
  }

  async deleteAppointment(id: string) {
    const appointment = await this.appointmentModel.findByIdAndDelete(id);
    if (!appointment) {
      throw new BadRequestException('Appointment not found');
    }
    return { message: 'Appointment deleted successfully' };
  }

  async updateAppointment(
    id: string,
    updateData: {
      name?: string;
      phoneNumber?: string;
      service?: ServiceKey;
      start?: string;
      tzOffset?: number;
      end?: string;
    },
  ) {
    const appointment = await this.appointmentModel.findById(id);
    if (!appointment) {
      throw new BadRequestException('Appointment not found');
    }

    // If start time is being updated, we need to validate it
    if (updateData.start) {
      const startDate = new Date(updateData.start);
      if (Number.isNaN(startDate.getTime())) {
        throw new BadRequestException('invalid start date');
      }

      const service = updateData.service || appointment.service;
      const durationMinutes = SERVICE_DURATION_MINUTES[service];
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      // Check working hours and overlap
      const providedOffset = updateData.tzOffset;
      const parsedOffset = Number(providedOffset);
      const effectiveTzOffset: number = Number.isFinite(parsedOffset)
        ? parsedOffset
        : 0;

      const { startHour, endHour } = this.getWorkingHours(startDate, effectiveTzOffset);
      const offsetMs = effectiveTzOffset * 60000;
      const localYmd = new Date(startDate.getTime() - offsetMs)
        .toISOString()
        .split('T')[0];
      const localMidnightUtcMs = new Date(localYmd + 'T00:00:00.000Z').getTime() + offsetMs;
      const dayStart = new Date(localMidnightUtcMs + startHour * 60 * 60000);
      const dayEnd = new Date(localMidnightUtcMs + endHour * 60 * 60000);

      if (startDate < dayStart || endDate > dayEnd) {
        throw new BadRequestException('Outside working hours');
      }

      // Check for overlapping appointments (excluding the current one)
      const overlapping = await this.appointmentModel.exists({
        _id: { $ne: id },
        start: { $lt: endDate.toISOString() },
        end: { $gt: startDate.toISOString() },
      });
      if (overlapping) {
        throw new BadRequestException('Time slot is busy');
      }

      // Update end time based on new start time and service duration
      updateData.end = endDate.toISOString();
    }

    // Update the appointment
    const updatedAppointment = await this.appointmentModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedAppointment) {
      throw new BadRequestException('Failed to update appointment');
    }

    return updatedAppointment;
  }
}


