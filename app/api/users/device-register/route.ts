import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { UsersRepository } from '@/lib/repositories/users.repository';
import { DeviceSchema } from '@/lib/validations/auth.dto';
import { validateRequest } from '@/lib/utils/validate-request';

/**
 * @swagger
 * /api/users/device-register:
 *   post:
 *     summary: Register or update device token for push notifications
 *     description: Register a new device token or update existing one. Should be called after login and whenever FCM token refreshes.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - device_token
 *               - device_type
 *             properties:
 *               device_token:
 *                 type: string
 *                 description: FCM device token from Firebase Cloud Messaging SDK
 *                 example: "dK8xYz123abc..."
 *               device_type:
 *                 type: string
 *                 enum: [ios, android, web]
 *                 description: Device platform type
 *                 example: "ios"
 *               app_version:
 *                 type: string
 *                 description: App version (optional)
 *                 example: "1.0.0"
 *               os_version:
 *                 type: string
 *                 description: Operating system version (optional)
 *                 example: "17.0"
 *               device_name:
 *                 type: string
 *                 description: Device name/model (optional)
 *                 example: "iPhone 15 Pro"
 *               is_active:
 *                 type: boolean
 *                 description: "Whether device is active (default: true)"
 *                 example: true
 *     responses:
 *       200:
 *         description: Device registered/updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Device registered successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deviceId:
 *                       type: string
 *                       format: uuid
 *                     isNewDevice:
 *                       type: boolean
 *                       description: Whether this is a new device or existing device was updated
 *       400:
 *         description: Bad request - Invalid device data
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error
 */
async function postHandler(req: AuthenticatedRequest) {
  try {
    // Get authenticated user from middleware
    const user = (req as any).user;
    const userId = user.userId;

    console.log('📱 [DEVICE REGISTER] Received device registration request');
    console.log('📱 [DEVICE REGISTER] User ID:', userId);

    // Validate request body
    const validation = await validateRequest(req, DeviceSchema);
    if (!validation.success) {
      return validation.response;
    }

    const deviceData = validation.data;
    console.log('📱 [DEVICE REGISTER] Device data:', {
      device_type: deviceData.device_type,
      has_token: !!deviceData.device_token,
      token_length: deviceData.device_token?.length || 0,
      app_version: deviceData.app_version,
      os_version: deviceData.os_version,
    });

    // Check if device already exists for this user
    const userRepository = new UsersRepository();
    const existingDevice = await userRepository.findDeviceByToken(
      deviceData.device_token,
      userId
    );

    // Also check if device exists for any other user (needs to be transferred)
    const deviceForAnyUser = await userRepository.findDeviceByTokenAnyUser(
      deviceData.device_token
    );

    let device;
    let isNewDevice = false;

    if (existingDevice) {
      // Device already exists for current user - just update usage
      console.log('📱 [DEVICE REGISTER] Device already exists for current user, updating...');
      console.log('📱 [DEVICE REGISTER] Existing device ID:', existingDevice.id);
      
      device = await userRepository.updateDeviceUsage(existingDevice.id, {
        app_version: deviceData.app_version,
        os_version: deviceData.os_version,
        device_name: deviceData.device_name,
      });

      console.log('✅ [DEVICE REGISTER] Device updated successfully');
    } else if (deviceForAnyUser && deviceForAnyUser.userId !== userId) {
      // Device exists for another user - transfer it to current user
      console.log('📱 [DEVICE REGISTER] Device exists for another user, transferring...');
      console.log('📱 [DEVICE REGISTER] Device ID:', deviceForAnyUser.id);
      console.log('📱 [DEVICE REGISTER] From user:', deviceForAnyUser.userId);
      console.log('📱 [DEVICE REGISTER] To user:', userId);
      
      device = await userRepository.transferDeviceToUser(deviceForAnyUser.id, userId);
      
      console.log('✅ [DEVICE REGISTER] Device transferred successfully');
    } else {
      // Create new device
      console.log('📱 [DEVICE REGISTER] Creating new device...');
      
      device = await userRepository.createDevice(
        {
          device_token: deviceData.device_token,
          device_type: deviceData.device_type,
          app_version: deviceData.app_version,
          os_version: deviceData.os_version,
          device_name: deviceData.device_name,
          is_active: deviceData.is_active ?? true,
        },
        userId
      );
      
      isNewDevice = true;
      console.log('✅ [DEVICE REGISTER] New device created successfully');
      console.log('✅ [DEVICE REGISTER] Device ID:', device[0]?.id);
    }

    return NextResponse.json(
      {
        success: true,
        message: isNewDevice ? 'Device registered successfully' : 'Device updated successfully',
        data: {
          deviceId: device[0]?.id,
          isNewDevice,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ [DEVICE REGISTER] Error registering device:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to register device',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Export with authentication middleware - any authenticated user can register their device
export const POST = withAuth(postHandler, ['doctor', 'hospital', 'admin']);

