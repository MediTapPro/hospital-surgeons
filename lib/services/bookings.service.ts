import { BookingsRepository, CreateBookingData, BookingQuery } from '@/lib/repositories/bookings.repository';

export interface CreateBookingDto {
  hospitalId: string;
  doctorId: string;
  patientId: string; // Required for assignments
  specialtyId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  estimatedPatients?: number;
  specialRequirements?: string;
  doctorFee: number;
  commissionAmount: number;
  totalAmount: number;
}

export interface UpdateBookingDto {
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  checkInTime?: string;
  checkOutTime?: string;
  estimatedPatients?: number;
  specialRequirements?: string;
}

export class BookingsService {
  private bookingsRepository = new BookingsRepository();

  async createBooking(createBookingDto: CreateBookingDto) {
    try {
      if (createBookingDto.startTime >= createBookingDto.endTime) {
        return {
          success: false,
          message: 'Start time must be before end time',
        };
      }

      if (createBookingDto.totalAmount !== (createBookingDto.doctorFee + createBookingDto.commissionAmount)) {
        return {
          success: false,
          message: 'Total amount must equal doctor fee plus commission amount',
        };
      }

      const availability = await this.bookingsRepository.checkDoctorAvailability(
        createBookingDto.doctorId,
        createBookingDto.bookingDate,
        createBookingDto.startTime,
        createBookingDto.endTime
      );

      if (!availability.isAvailable) {
        return {
          success: false,
          message: 'Doctor is not available at the requested time slot',
        };
      }

      // Map CreateBookingDto to CreateBookingData
      const bookingData: CreateBookingData = {
        hospitalId: createBookingDto.hospitalId,
        doctorId: createBookingDto.doctorId,
        patientId: createBookingDto.patientId,
        priority: 'medium',
        consultationFee: createBookingDto.doctorFee,
        treatmentNotes: createBookingDto.specialRequirements,
      };
      
      const booking = await this.bookingsRepository.createBooking(bookingData);

      return {
        success: true,
        message: 'Booking created successfully',
        data: booking[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create booking',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findBookings(query: BookingQuery) {
    try {
      const bookings = await this.bookingsRepository.findBookings(query);
      
      return {
        success: true,
        message: 'Bookings retrieved successfully',
        data: bookings,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 10,
          total: bookings.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve bookings',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findBookingById(id: string) {
    try {
      const booking = await this.bookingsRepository.findBookingById(id);
      
      if (!booking) {
        return {
          success: false,
          message: 'Booking not found',
        };
      }

      return {
        success: true,
        message: 'Booking retrieved successfully',
        data: booking,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve booking',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateBooking(id: string, updateBookingDto: UpdateBookingDto) {
    try {
      const booking = await this.bookingsRepository.findBookingById(id);
      if (!booking) {
        return {
          success: false,
          message: 'Booking not found',
        };
      }

      if (updateBookingDto.status) {
        const validTransitions: Record<string, string[]> = {
          'pending': ['confirmed', 'cancelled'],
          'confirmed': ['completed', 'cancelled', 'no_show'],
          'completed': [],
          'cancelled': [],
          'no_show': [],
        };

        const currentStatus = booking.booking.status;
        if (currentStatus && !validTransitions[currentStatus]?.includes(updateBookingDto.status)) {
          return {
            success: false,
            message: `Cannot change status from ${currentStatus} to ${updateBookingDto.status}`,
          };
        }
      }

      const updatedBooking = await this.bookingsRepository.updateBooking(id, updateBookingDto);

      return {
        success: true,
        message: 'Booking updated successfully',
        data: updatedBooking[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update booking',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteBooking(id: string) {
    try {
      const booking = await this.bookingsRepository.findBookingById(id);
      if (!booking) {
        return {
          success: false,
          message: 'Booking not found',
        };
      }

      if (booking.booking.status !== 'pending') {
        return {
          success: false,
          message: 'Only pending bookings can be deleted',
        };
      }

      await this.bookingsRepository.deleteBooking(id);

      return {
        success: true,
        message: 'Booking deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete booking',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async checkAvailability(doctorId: string, bookingDate: string, startTime: string, endTime: string) {
    try {
      const availability = await this.bookingsRepository.checkDoctorAvailability(
        doctorId,
        bookingDate,
        startTime,
        endTime
      );

      return {
        success: true,
        message: 'Availability checked successfully',
        data: availability,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to check availability',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getAvailableTimeSlots(doctorId: string, bookingDate: string) {
    try {
      const slots = await this.bookingsRepository.getAvailableTimeSlots(doctorId, bookingDate);

      return {
        success: true,
        message: 'Available time slots retrieved successfully',
        data: slots,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve available time slots',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getBookingStats() {
    try {
      const stats = await this.bookingsRepository.getBookingStats();

      return {
        success: true,
        message: 'Booking statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve booking statistics',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}









































