'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// import Header from '../../components/Header';

export default function DoctorRegistrationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dentalLicenseNumber: '',
    yearsOfPractice: '',
    email: '',
    password: '',
    phone: '',
    fullAddress: '',
    city: '',
    state: '',
    pincode: '',
    specialties: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [specialtiesList, setSpecialtiesList] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = (field: string, value: any): string | null => {
    switch (field) {
      case 'firstName':
        if (!value || !value.trim()) {
          return 'First name is required';
        }
        if (value.trim().length < 2) {
          return 'First name must be at least 2 characters';
        }
        return null;
      
      case 'lastName':
        if (!value || !value.trim()) {
          return 'Last name is required';
        }
        if (value.trim().length < 2) {
          return 'Last name must be at least 2 characters';
        }
        return null;
      
      case 'dentalLicenseNumber':
        if (!value || !value.trim()) {
          return 'License number is required';
        }
        if (value.trim().length < 3) {
          return 'License number must be at least 3 characters';
        }
        return null;
      
      case 'email':
        if (!value || !value.trim()) {
          return 'Email is required';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Please enter a valid email address';
        }
        return null;
      
      case 'phone':
        if (!value || !value.trim()) {
          return 'Phone number is required';
        }
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 10) {
          return 'Please enter a valid phone number';
        }
        return null;
      
      case 'password':
        if (!value) {
          return 'Password is required';
        }
        if (value.length < 8) {
          return 'Password must be at least 8 characters';
        }
        if (!/(?=.*[a-z])/.test(value)) {
          return 'Password must contain at least one lowercase letter';
        }
        if (!/(?=.*[A-Z])/.test(value)) {
          return 'Password must contain at least one uppercase letter';
        }
        if (!/(?=.*\d)/.test(value)) {
          return 'Password must contain at least one number';
        }
        return null;
      
      case 'yearsOfPractice':
        if (!value) {
          return 'Years of practice is required';
        }
        const years = parseInt(value);
        if (isNaN(years) || years < 0) {
          return 'Please enter a valid number of years';
        }
        if (years > 50) {
          return 'Years of practice cannot exceed 50';
        }
        return null;
      
      default:
        return null;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const field = e.target.name;
    const value = e.target.value;
    
    setFormData({
      ...formData,
      [field]: value,
    });
    
    // Validate field immediately
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
    // Re-validate on blur for better UX
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

  const handleNext = () => {
    // Validate step 3 before proceeding
    if (step === 3 && formData.specialties.length === 0) {
      alert('Please select at least one specialty');
      return;
    }
    
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate specialties
      if (formData.specialties.length === 0) {
        alert('Please select at least one specialty');
        setLoading(false);
        return;
      }

      // Prepare specialties array for API
      const specialtiesArray = formData.specialties.map((specialtyId, index) => ({
        specialtyId,
        isPrimary: index === 0, // First specialty is primary
      }));

      // Use the new single API endpoint
      const response = await fetch('/api/doctors/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          firstName: formData.firstName,
          lastName: formData.lastName,
          medicalLicenseNumber: formData.dentalLicenseNumber, // Note: using dentalLicenseNumber from form
          yearsOfExperience: parseInt(formData.yearsOfPractice) || 0,
          fullAddress: formData.fullAddress || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          pincode: formData.pincode || undefined,
          specialties: specialtiesArray,
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
        router.push(`/login?role=doctor&registered=true&email=${encodeURIComponent(formData.email)}`);
      } else {
        alert(data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Personal', 'Practice', 'Professional'];
  const progress = (step / 3) * 100;

  // Fetch specialties when component mounts or step 3 is reached
  useEffect(() => {
    if (step === 3 && specialtiesList.length === 0) {
      fetchSpecialties();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const fetchSpecialties = async () => {
    setLoadingSpecialties(true);
    try {
      const response = await fetch('/api/specialties/active');
      const data = await response.json();
      if (data.success && data.data) {
        setSpecialtiesList(data.data);
      }
    } catch (error) {
      console.error('Error fetching specialties:', error);
    } finally {
      setLoadingSpecialties(false);
    }
  };

  const handleSpecialtyToggle = (specialtyId: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialtyId)
        ? prev.specialties.filter(id => id !== specialtyId)
        : [...prev.specialties, specialtyId]
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* <Header /> */}

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Dentist Profile</h1>
            <p className="text-gray-600">Set up your professional profile to start collaborating with dental labs</p>
          </div>

          {/* Registration Form Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Progress Indicator */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Step {step} of 3</span>
                <span className="text-sm text-gray-500">{Math.round(progress)}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gray-800 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-4">
                {steps.map((stepName, index) => (
                  <div
                    key={index}
                    className={`text-sm ${
                      index + 1 === step
                        ? 'text-blue-600 font-semibold'
                        : index + 1 < step
                        ? 'text-gray-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {stepName}
                  </div>
                ))}
              </div>
            </div>

            {/* Profile Picture Section */}
            {step === 1 && (
              <div className="mb-8 text-center">
                <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl font-bold text-blue-600">
                    {formData.firstName[0] || 'D'}{formData.lastName[0] || 'D'}
                  </span>
                </div>
                <button className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 mx-auto">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Photo
                </button>
              </div>
            )}

            {/* Form Steps */}
            <form onSubmit={step === 3 ? handleSubmit : undefined}>
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      onBlur={(e) => handleBlur('firstName', e.target.value)}
                      required
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.firstName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="John"
                    />
                    {errors.firstName && <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>}
                  </div>

                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      onBlur={(e) => handleBlur('lastName', e.target.value)}
                      required
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.lastName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Smith"
                    />
                    {errors.lastName && <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>}
                  </div>

                  <div>
                    <label htmlFor="dentalLicenseNumber" className="block text-sm font-medium text-gray-700 mb-2">
                      Dental License Number *
                    </label>
                    <input
                      type="text"
                      id="dentalLicenseNumber"
                      name="dentalLicenseNumber"
                      value={formData.dentalLicenseNumber}
                      onChange={handleInputChange}
                      onBlur={(e) => handleBlur('dentalLicenseNumber', e.target.value)}
                      required
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.dentalLicenseNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="DDS-12345"
                    />
                    {errors.dentalLicenseNumber && <p className="mt-1 text-sm text-red-500">{errors.dentalLicenseNumber}</p>}
                  </div>

                  <div>
                    <label htmlFor="yearsOfPractice" className="block text-sm font-medium text-gray-700 mb-2">
                      Years of Practice
                    </label>
                    <select
                      id="yearsOfPractice"
                      name="yearsOfPractice"
                      value={formData.yearsOfPractice}
                      onChange={handleInputChange}
                      onBlur={(e) => handleBlur('yearsOfPractice', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.yearsOfPractice ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select years of experience</option>
                      {Array.from({ length: 50 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1} {i === 0 ? 'year' : 'years'}
                        </option>
                      ))}
                    </select>
                    {errors.yearsOfPractice && <p className="mt-1 text-sm text-red-500">{errors.yearsOfPractice}</p>}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      onBlur={(e) => handleBlur('email', e.target.value)}
                      required
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      onBlur={(e) => handleBlur('phone', e.target.value)}
                      required
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      Password *
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      onBlur={(e) => handleBlur('password', e.target.value)}
                      required
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Details</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Provide location information for better accuracy. More details = more accurate coordinates.
                    </p>
                    
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="fullAddress" className="block text-sm font-medium text-gray-700 mb-2">
                          Full Address
                        </label>
                        <input
                          type="text"
                          id="fullAddress"
                          name="fullAddress"
                          value={formData.fullAddress}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., 123 Main Street, Building Name, Area"
                        />
                        <p className="mt-1 text-xs text-gray-500">Street address with building/area name (for high accuracy)</p>
                      </div>

                      <div>
                        <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                          City
                        </label>
                        <input
                          type="text"
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., Mumbai"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                            State
                          </label>
                          <input
                            type="text"
                            id="state"
                            name="state"
                            value={formData.state}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g., Maharashtra"
                          />
                        </div>

                        <div>
                          <label htmlFor="pincode" className="block text-sm font-medium text-gray-700 mb-2">
                            Pincode
                          </label>
                          <input
                            type="text"
                            id="pincode"
                            name="pincode"
                            value={formData.pincode}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g., 400001"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Specialties *
                    </label>
                    <p className="text-sm text-gray-500 mb-4">Choose the medical specialties you practice</p>
                    {loadingSpecialties ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">Loading specialties...</p>
                      </div>
                    ) : specialtiesList.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No specialties available</p>
                      </div>
                    ) : (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-3 ">
                          {specialtiesList.map((specialty) => (
                            <label
                              key={specialty.id}
                              className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formData.specialties.includes(specialty.id)}
                                onChange={() => handleSpecialtyToggle(specialty.id)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{specialty.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {formData.specialties.length > 0 && (
                      <p className="text-sm text-gray-600 mt-2">
                        Selected: {formData.specialties.length} {formData.specialties.length === 1 ? 'specialty' : 'specialties'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={step === 1}
                  className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading || formData.specialties.length === 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {loading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating Profile...
                      </>
                    ) : (
                      <>
                        Complete Registration
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

