'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, User, Heart, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { isAuthenticated } from '@/lib/auth/utils';
import { useRouter } from 'next/navigation';

interface AddPatientWizardProps {
  onClose: () => void;
  onComplete?: () => void;
}

export function AddPatientWizard({ onClose, onComplete }: AddPatientWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    // Step 1: Personal Information
    fullName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    emergencyContact: '',
    address: '',
    
    // Step 2: Medical Details
    condition: '',
    specialty: '',
    roomType: '',
    costPerDay: '',
    medicalNotes: '',
    
    // Step 3: Consent
    dataPrivacy: false,
    doctorAssignment: false,
    treatmentConsent: false,
    consentGiverName: '',
    relationship: '',
  });

  const specialties = [
    'Cardiology',
    'Orthopedics',
    'Neurology',
    'General Medicine',
    'Pediatrics',
    'Dermatology',
    'Endocrinology',
    'Gastroenterology',
    'Oncology',
    'Psychiatry',
  ];

  const roomTypes = [
    { value: 'general', label: 'General Ward', cost: '₹1,500' },
    { value: 'semi_private', label: 'Semi-Private', cost: '₹3,000' },
    { value: 'private', label: 'Private Room', cost: '₹5,000' },
    { value: 'icu', label: 'ICU', cost: '₹10,000' },
    { value: 'emergency', label: 'Emergency', cost: '₹8,000' },
  ];

  const steps = [
    { number: 1, title: 'Personal Information', icon: User },
    { number: 2, title: 'Medical Details', icon: Heart },
    { number: 3, title: 'Consent', icon: FileText },
  ];

  useEffect(() => {
    if (isAuthenticated()) {
      fetchHospitalProfile();
    }
  }, []);

  const fetchHospitalProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/hospitals/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setHospitalId(data.data.id);
      } else {
        setError('Failed to load hospital profile');
      }
    } catch (err) {
      console.error('Error fetching hospital profile:', err);
      setError('Failed to load hospital profile');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (submitting) return; // Prevent double-click
    
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Submit the form
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (submitting) return; // Prevent double-click
    
    if (!hospitalId) {
      setError('Hospital ID not found. Please try again.');
      return;
    }

    // Validate all required fields
    if (!formData.fullName || !formData.dateOfBirth || !formData.gender || !formData.phone) {
      setError('Please fill in all required fields in Step 1');
      setStep(1);
      return;
    }

    if (!formData.condition || !formData.specialty || !formData.roomType) {
      setError('Please fill in all required fields in Step 2');
      setStep(2);
      return;
    }

    if (!formData.dataPrivacy || !formData.doctorAssignment || !formData.treatmentConsent || 
        !formData.consentGiverName || !formData.relationship) {
      setError('Please complete all consent fields in Step 3');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      // Calculate cost per day based on room type
      const costPerDayMap: Record<string, number> = {
        'general': 1500,
        'semi_private': 3000,
        'private': 5000,
        'icu': 10000,
        'emergency': 8000,
      };

      const requestBody = {
        fullName: formData.fullName,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        phone: formData.phone,
        emergencyContact: formData.emergencyContact || null,
        address: formData.address || null,
        condition: formData.condition,
        medicalCondition: formData.condition,
        roomType: formData.roomType,
        costPerDay: costPerDayMap[formData.roomType] || 1500,
        medicalNotes: formData.medicalNotes || null,
        // Consent data
        dataPrivacy: formData.dataPrivacy,
        doctorAssignment: formData.doctorAssignment,
        treatmentConsent: formData.treatmentConsent,
        consentGiverName: formData.consentGiverName,
        relationship: formData.relationship,
      };

      const response = await fetch(`/api/hospitals/${hospitalId}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        // Success - call onComplete or navigate
        if (onComplete) {
          onComplete();
        } else {
          router.push('/hospital/find-doctors');
        }
      } else {
        // Show specific error message for limit reached
        const errorMessage = data.message || 'Failed to create patient. Please try again.';
        if (data.error === 'PATIENT_LIMIT_REACHED' || data.code === 'PATIENT_LIMIT_REACHED') {
          // Use the detailed message from API which includes usage and reset date
          setError(errorMessage);
        } else {
          setError(errorMessage);
        }
      }
    } catch (err) {
      console.error('Error creating patient:', err);
      setError('Failed to create patient. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      onClose();
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return formData.fullName && formData.dateOfBirth && formData.gender && formData.phone;
      case 2:
        return formData.condition && formData.specialty && formData.roomType;
      case 3:
        return formData.dataPrivacy && formData.doctorAssignment && formData.treatmentConsent && formData.consentGiverName && formData.relationship;
      default:
        return false;
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <Button variant="ghost" onClick={onClose} className="mb-4 gap-2" disabled={submitting}>
          <ArrowLeft className="w-4 h-4" />
          Back to Patients
        </Button>
        <h1 className="text-gray-900 mb-1">Add New Patient</h1>
        <p className="text-gray-500">Complete the form to register a new patient</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((s, index) => {
            const Icon = s.icon;
            const isCompleted = s.number < step;
            const isActive = s.number === step;
            
            return (
              <div key={s.number} className="flex items-center flex-1">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-blue-600 text-white'
                        : isActive
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Step {s.number}</p>
                    <p className={`${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                      {s.title}
                    </p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${isCompleted ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{steps[step - 1].title}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="Enter full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Emergency Contact</Label>
                <Input
                  id="emergencyContact"
                  placeholder="Emergency contact number"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  placeholder="Enter complete address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 2: Medical Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="condition">Medical Condition *</Label>
                <Input
                  id="condition"
                  placeholder="Describe the medical condition"
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialty">Required Specialty *</Label>
                <Select value={formData.specialty} onValueChange={(value) => setFormData({ ...formData, specialty: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    {specialties.map((specialty) => (
                      <SelectItem key={specialty} value={specialty}>
                        {specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="roomType">Room Type *</Label>
                <Select value={formData.roomType} onValueChange={(value) => setFormData({ ...formData, roomType: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map((room) => (
                      <SelectItem key={room.value} value={room.value}>
                        {room.label} - {room.cost}/day
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="medicalNotes">Medical Notes</Label>
                <Textarea
                  id="medicalNotes"
                  placeholder="Additional medical information, allergies, current medications..."
                  value={formData.medicalNotes}
                  onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Step 3: Consent */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="dataPrivacy"
                    checked={formData.dataPrivacy}
                    onCheckedChange={(checked) => setFormData({ ...formData, dataPrivacy: checked as boolean })}
                  />
                  <div>
                    <Label htmlFor="dataPrivacy" className="cursor-pointer">
                      Data Privacy Consent *
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      I consent to the collection and processing of patient data for treatment purposes
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="doctorAssignment"
                    checked={formData.doctorAssignment}
                    onCheckedChange={(checked) => setFormData({ ...formData, doctorAssignment: checked as boolean })}
                  />
                  <div>
                    <Label htmlFor="doctorAssignment" className="cursor-pointer">
                      Doctor Assignment Authorization *
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      I authorize the hospital to assign appropriate doctors for treatment
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="treatmentConsent"
                    checked={formData.treatmentConsent}
                    onCheckedChange={(checked) => setFormData({ ...formData, treatmentConsent: checked as boolean })}
                  />
                  <div>
                    <Label htmlFor="treatmentConsent" className="cursor-pointer">
                      Treatment Consent *
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      I consent to medical treatment and procedures as deemed necessary by assigned doctors
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="consentGiverName">Consent Giver Name *</Label>
                  <Input
                    id="consentGiverName"
                    placeholder="Name of person providing consent"
                    value={formData.consentGiverName}
                    onChange={(e) => setFormData({ ...formData, consentGiverName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship">Relationship to Patient *</Label>
                  <Input
                    id="relationship"
                    placeholder="e.g., Self, Spouse, Parent, Guardian"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-900">
                  By providing consent, you acknowledge that all information provided is accurate and agree to the hospital's terms of service.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button variant="outline" onClick={handleBack} className="gap-2" disabled={submitting}>
              <ArrowLeft className="w-4 h-4" />
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            <Button 
              onClick={handleNext} 
              disabled={!isStepValid() || submitting || !hospitalId} 
              className="gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  {step === 3 ? 'Complete & Find Doctor' : 'Next'}
                  {step < 3 && <ArrowRight className="w-4 h-4" />}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
