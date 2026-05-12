import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { eventsApi } from '../../api/events.api';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'MONTHLY_MEETING', label: 'Monthly Meeting' },
  { value: 'SPECIAL_MEETING', label: 'Special Meeting' },
  { value: 'COMMUNITY_EVENT', label: 'Community Event' },
  { value: 'VOLUNTEER_EVENT', label: 'Volunteer Event' },
  { value: 'RELIGIOUS_EVENT', label: 'Religious Event' },
  { value: 'OTHER', label: 'Other' },
];

export default function EventCreatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const createMutation = useMutation({
    mutationFn: (data: any) => isEdit ? eventsApi.update(id!, data) : eventsApi.create(data),
    onSuccess: (res) => {
      toast.success(isEdit ? 'Event updated' : 'Event created');
      navigate(`/events/${res.data.data.id}`);
    },
    onError: () => toast.error('Failed to save event'),
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>Back</Button>
        <h1 className="page-title">{isEdit ? 'Edit Event' : 'Create Event'}</h1>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
          <Input label="Event Title" placeholder="e.g. Monthly General Meeting" error={errors.title?.message as string}
            {...register('title', { required: 'Title is required' })} />

          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[100px] resize-none"
              placeholder="Event description..."
              {...register('description')}
            />
          </div>

          <Select label="Category" options={CATEGORIES} {...register('category', { required: true })} />

          <Input label="Location" placeholder="Venue or online link" {...register('location')} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date & Time" type="datetime-local" error={errors.startTime?.message as string}
              {...register('startTime', { required: 'Required' })} />
            <Input label="End Date & Time" type="datetime-local" error={errors.endTime?.message as string}
              {...register('endTime', { required: 'Required' })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Max Attendees (optional)" type="number" placeholder="Leave empty for unlimited" {...register('maxAttendees')} />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded" {...register('requiresRsvp')} />
              <span>Requires RSVP</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded" {...register('requiresFee')} />
              <span>Has Event Fee</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting} icon={<Save size={16} />}>
              {isEdit ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
