'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// import Header from '../../components/Header';

interface Specialty {
  id: string;
  name: string;
}

export default function HospitalRegistrationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    city: '',
    fullAddress: '',
    state: '',
    pincode: '',
    registrationNumber: '',
    numberOfBeds: '',
    hospitalType: '',
    departments: [] as string[], // Array of specialty IDs
  });

  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    { id: 1, label: 'Organization' },
    { id: 2, label: 'Location' },
    { id: 3, label: 'Professional' },
    { id: 4, label: 'Departments' },
  ];

  useEffect(() => {
    fetch('/api/specialties/active')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSpecialties(data.data || []);
        }
      });
  }, []);

  const validateField = (field: string, value: any): string | null => {
    switch (field) {
      case 'name':
        if (!value || !value.trim()) return 'Hospital name is required';
        if (value.trim().length < 3) return 'Hospital name must be at least 3 characters';
        return null;
      case 'email':
        if (!value || !value.trim()) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email address';
        return null;
      case 'phone':
        if (!value || !value.trim()) return 'Phone number is required';
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 10) return 'Please enter a valid phone number';
        return null;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/(?=.*[a-z])/.test(value)) return 'Password must contain at least one lowercase letter';
        if (!/(?=.*[A-Z])/.test(value)) return 'Password must contain at least one uppercase letter';
        if (!/(?=.*\d)/.test(value)) return 'Password must contain at least one number';
        return null;
      case 'address':
        if (!value || !value.trim()) return 'Address is required';
        if (value.trim().length < 5) return 'Address must be at least 5 characters';
        return null;
      case 'city':
        if (!value || !value.trim()) return 'City is required';
        if (value.trim().length < 2) return 'City must be at least 2 characters';
        return null;
      case 'registrationNumber':
        if (!value || !value.trim()) return 'Registration number is required';
        if (value.trim().length < 3) return 'Registration number must be at least 3 characters';
        return null;
      case 'numberOfBeds':
        if (value && value.trim()) {
          const beds = parseInt(value);
          if (isNaN(beds) || beds < 0) return 'Number of beds must be a non-negative number';
          if (beds > 10000) return 'Number of beds cannot exceed 10,000';
        }
        return null;
      default:
        return null;
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    const error = validateField(field, value);
    setErrors((prev) => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[field] = error;
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });
  };

  const handleBlur = (field: string, value: any) => {
    const error = validateField(field, value);
    setErrors((prev) => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[field] = error;
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });
  };

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNumber === 1) {
      const nameError = validateField('name', formData.name);
      const emailError = validateField('email', formData.email);
      const phoneError = validateField('phone', formData.phone);
      const passwordError = validateField('password', formData.password);

      if (nameError) newErrors.name = nameError;
      if (emailError) newErrors.email = emailError;
      if (phoneError) newErrors.phone = phoneError;
      if (passwordError) newErrors.password = passwordError;
    } else if (stepNumber === 2) {
      const addressError = validateField('address', formData.address);
      const cityError = validateField('city', formData.city);

      if (addressError) newErrors.address = addressError;
      if (cityError) newErrors.city = cityError;
    } else if (stepNumber === 3) {
      const registrationError = validateField('registrationNumber', formData.registrationNumber);
      const bedsError = validateField('numberOfBeds', formData.numberOfBeds);

      if (registrationError) newErrors.registrationNumber = registrationError;
      if (bedsError) newErrors.numberOfBeds = bedsError;
    } else if (stepNumber === 4) {
      if (formData.departments.length === 0) {
        newErrors.departments = 'Please select at least one department';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) {
      return;
    }

    if (step < totalSteps) {
      setStep(step + 1);
    } else if (step === totalSteps) {
      // Final step, submit all data
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const departmentsArray = formData.departments.map((specialtyId) => ({
        specialtyId,
      }));

      const response = await fetch('/api/hospitals/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          name: formData.name,
          registrationNumber: formData.registrationNumber,
          address: formData.address,
          city: formData.city,
          fullAddress: formData.fullAddress || undefined,
          state: formData.state || undefined,
          pincode: formData.pincode || undefined,
          hospitalType: formData.hospitalType || null,
          numberOfBeds: formData.numberOfBeds ? parseInt(formData.numberOfBeds) : null,
          departments: departmentsArray,
          device: {
            device_token: 'web-token-' + Date.now(),
            device_type: 'web',
            app_version: '1.0.0',
            os_version: '1.0.0',
            is_active: true,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Don't store token from registration - user must log in explicitly
        // This ensures proper authentication flow and correct navigation
        // Redirect to login page with success message and email pre-filled
        router.push(`/login?role=hospital&registered=true&email=${encodeURIComponent(formData.email)}`);
      } else {
        setErrors({ submit: data.message || data.error || 'Registration failed' });
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ submit: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDepartment = (specialtyId: string) => {
    const isSelected = formData.departments.includes(specialtyId);
    const newDepartments = isSelected
      ? formData.departments.filter((id) => id !== specialtyId)
      : [...formData.departments, specialtyId];

    handleInputChange('departments', newDepartments);
  };

  const progressPercentage = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* <Header /> */}

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Hospital Profile</h1>
            <p className="text-gray-600">Set up your hospital profile to start connecting with surgeons</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Step {step} of {totalSteps}</span>
                <span className="text-sm font-medium text-gray-700">{Math.round(progressPercentage)}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between">
                {steps.map((s) => (
                  <div
                    key={s.id}
                    className={`text-sm font-medium ${
                      s.id === step
                        ? 'text-blue-600'
                        : s.id < step
                        ? 'text-gray-900'
                        : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hospital Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    onBlur={(e) => handleBlur('name', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter hospital name"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    onBlur={(e) => handleBlur('email', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your email"
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    onBlur={(e) => handleBlur('phone', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter phone number"
                  />
                  {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      onBlur={(e) => handleBlur('password', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Create a password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showPassword ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        ) : (
                          <>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    onBlur={(e) => handleBlur('address', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.address ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter hospital address"
                  />
                  {errors.address && <p className="mt-1 text-sm text-red-500">{errors.address}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    onBlur={(e) => handleBlur('city', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.city ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter city"
                  />
                  {errors.city && <p className="mt-1 text-sm text-red-500">{errors.city}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Address</label>
                  <input
                    type="text"
                    value={formData.fullAddress}
                    onChange={(e) => handleInputChange('fullAddress', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter full address (building name, street, area)"
                  />
                  <p className="mt-1 text-xs text-gray-500">Street address with building/area name (for better accuracy)</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter state"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => handleInputChange('pincode', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter pincode"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Registration Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.registrationNumber}
                    onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
                    onBlur={(e) => handleBlur('registrationNumber', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.registrationNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter registration number"
                  />
                  {errors.registrationNumber && <p className="mt-1 text-sm text-red-500">{errors.registrationNumber}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hospital Type</label>
                  <select
                    value={formData.hospitalType}
                    onChange={(e) => handleInputChange('hospitalType', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select hospital type</option>
                    <option value="general">General</option>
                    <option value="specialty">Specialty</option>
                    <option value="clinic">Clinic</option>
                    <option value="trauma_center">Trauma Center</option>
                    <option value="teaching">Teaching</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number of Beds</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.numberOfBeds}
                    onChange={(e) => handleInputChange('numberOfBeds', e.target.value)}
                    onBlur={(e) => handleBlur('numberOfBeds', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.numberOfBeds ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter number of beds"
                  />
                  {errors.numberOfBeds && <p className="mt-1 text-sm text-red-500">{errors.numberOfBeds}</p>}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Departments</h2>
                <p className="text-sm text-gray-600 mb-4">Choose the medical departments in your hospital</p>

                {errors.departments && (
                  <p className="text-sm text-red-500 mb-4">{errors.departments}</p>
                )}

                <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {specialties.map((specialty) => (
                    <button
                      key={specialty.id}
                      type="button"
                      onClick={() => toggleDepartment(specialty.id)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        formData.departments.includes(specialty.id)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm font-medium">{specialty.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {errors.submit && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={step === 1}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
                  step === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={isSubmitting || Object.keys(errors).length > 0}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Processing...' : step === totalSteps ? 'Complete Registration' : 'Next'}
                {!isSubmitting && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
