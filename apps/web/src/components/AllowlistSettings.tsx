import {useState} from 'react';
import useSWR from 'swr';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  IconSpinner,
} from '@merlin/ui';
import {AllowlistSchemas} from '@merlin/shared';
import {Trash2, UserPlus} from 'lucide-react';
import {AnimatePresence, motion} from 'framer-motion';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import type {z} from 'zod';
import {network} from '../lib/network';

interface AllowlistedEntry {
  id: string;
  email: string;
  addedByEmail: string | null;
  createdAt: string;
}

interface ShareableProject {
  id: string;
  name: string;
}

type AddAllowlistForm = z.infer<typeof AllowlistSchemas.add>;

export function AllowlistSettings() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [entryToRemove, setEntryToRemove] = useState<AllowlistedEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {data, mutate, isLoading} = useSWR<{success: boolean; data: AllowlistedEntry[]}>('/allowlist', {
    revalidateOnFocus: false,
  });

  const {data: shareableProjectsData, isLoading: isLoadingProjects} = useSWR<{
    success: boolean;
    data: ShareableProject[];
  }>('/allowlist/shareable-projects', {
    revalidateOnFocus: false,
  });

  const entries = data?.data || [];
  const shareableProjects = shareableProjectsData?.data ?? [];

  const form = useForm<AddAllowlistForm>({
    resolver: zodResolver(AllowlistSchemas.add),
    defaultValues: {
      email: '',
      projectIds: [],
    },
  });

  const selectedProjectIds = form.watch('projectIds') ?? [];

  const toggleProject = (projectId: string, checked: boolean) => {
    const current = form.getValues('projectIds') ?? [];
    if (checked) {
      form.setValue('projectIds', [...current, projectId], {shouldValidate: true});
      return;
    }

    form.setValue(
      'projectIds',
      current.filter(id => id !== projectId),
      {shouldValidate: true},
    );
  };

  const handleAdd = async (values: AddAllowlistForm) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await network.fetch<void, typeof AllowlistSchemas.add>('POST', '/allowlist', values);
      setSuccess('Email added to allowlist');
      await mutate();
      form.reset({email: '', projectIds: []});
      setShowAddDialog(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!entryToRemove) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await network.fetch('DELETE', `/allowlist/${entryToRemove.id}`);
      setSuccess('Email removed from allowlist');
      await mutate();
      setEntryToRemove(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove email');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            key="success"
            initial={{opacity: 0, y: -8}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -8}}
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {success}
          </motion.div>
        )}
        {error && (
          <motion.div
            key="error"
            initial={{opacity: 0, y: -8}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -8}}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Authorized emails</CardTitle>
            <CardDescription>
              People on this list can create an account even if their email domain is not trusted. Optionally share
              projects with them so those projects appear as soon as they sign in.
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <UserPlus className="h-4 w-4" />
            Add email
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <IconSpinner className="h-6 w-6" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-neutral-500 py-4">No authorized emails yet. Add someone to let them sign up.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Added by</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.email}</TableCell>
                    <TableCell className="text-neutral-500">{entry.addedByEmail ?? '—'}</TableCell>
                    <TableCell className="text-neutral-500">
                      {new Date(entry.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setEntryToRemove(entry)}
                        aria-label={`Remove ${entry.email}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add authorized email</DialogTitle>
            <DialogDescription>
              This person will be able to create an account. Share projects now so they appear immediately after signup.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={e => {
                e.preventDefault();
                void form.handleSubmit(handleAdd)(e);
              }}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="colleague@example.com" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectIds"
                render={() => (
                  <FormItem>
                    <FormLabel>Share projects (optional)</FormLabel>
                    <FormDescription>
                      Only projects where you are an admin or owner are listed. If the person already has an account,
                      access is granted immediately.
                    </FormDescription>
                    {isLoadingProjects ? (
                      <div className="flex items-center py-3">
                        <IconSpinner className="h-4 w-4" />
                      </div>
                    ) : shareableProjects.length === 0 ? (
                      <p className="text-sm text-neutral-500 py-2">You do not admin any projects yet.</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto rounded-md border border-neutral-200 p-3 space-y-3">
                        {shareableProjects.map(project => (
                          <label key={project.id} className="flex items-center gap-3 text-sm cursor-pointer">
                            <Checkbox
                              checked={selectedProjectIds.includes(project.id)}
                              onCheckedChange={checked => toggleProject(project.id, checked === true)}
                            />
                            <span>{project.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <IconSpinner className="h-4 w-4" />}
                  Add email
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!entryToRemove} onOpenChange={open => !open && setEntryToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove authorized email</DialogTitle>
            <DialogDescription>
              {entryToRemove
                ? `Remove ${entryToRemove.email} from the allowlist? They will no longer be able to create a new account, and their access to shared projects will be revoked.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEntryToRemove(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleRemove()} disabled={isSubmitting}>
              {isSubmitting && <IconSpinner className="h-4 w-4" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
