import {zodResolver} from '@hookform/resolvers/zod';
import type {Project} from '@merlin/db';
import {ProjectSchemas} from '@merlin/shared';
import {
  Button,
  Card,
  CardContent,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  IconSpinner,
  Input,
} from '@merlin/ui';
import {AnimatePresence, motion} from 'framer-motion';
import {FolderPlus, LogOut, UserPlus} from 'lucide-react';
import {NextSeo} from 'next-seo';
import {useRouter} from 'next/router';
import React, {useState} from 'react';
import {useForm} from 'react-hook-form';
import type {z} from 'zod';

import {useActiveProject} from '../../lib/contexts/ActiveProjectProvider';
import {useConfig} from '../../lib/hooks/useConfig';
import {useProjects} from '../../lib/hooks/useProject';
import {useUser} from '../../lib/hooks/useUser';
import {network} from '../../lib/network';

export default function CreateProject() {
  const {mutate: projectsMutate} = useProjects();
  const {setActiveProject} = useActiveProject();
  const router = useRouter();
  const {data: config} = useConfig();
  const {data: user} = useUser();

  const allowlistRestricted = config?.features.signup.allowlistRestricted ?? false;
  const canCreateProject = !allowlistRestricted || user?.canManageAllowlist === true;

  const form = useForm<z.infer<typeof ProjectSchemas.create>>({
    resolver: zodResolver(ProjectSchemas.create),
    defaultValues: {
      name: '',
    },
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogout() {
    try {
      await network.fetch('GET', '/auth/logout');
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('activeProjectId');
      await router.push('/auth/login');
    }
  }

  async function onSubmit(values: z.infer<typeof ProjectSchemas.create>) {
    try {
      const newProject = await network.fetch<Project, typeof ProjectSchemas.create>(
        'POST',
        '/users/@me/projects',
        values,
      );

      await projectsMutate();
      setActiveProject(newProject);
      await router.push('/onboarding');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    }
  }

  return (
    <>
      <NextSeo title="Create Project" />
      <div
        className={'min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 p-4'}
      >
        <div className={'flex flex-col gap-6 max-w-2xl w-full'}>
          <div className="text-center mb-2">
            <h1 className="text-3xl font-bold mb-2">Welcome to Merlin</h1>
            <p className="text-neutral-600">
              {canCreateProject ? "Choose how you'd like to get started" : 'Get access to a project shared with you'}
            </p>
          </div>

          <div className={canCreateProject ? 'grid md:grid-cols-2 gap-6' : 'max-w-md mx-auto w-full'}>
            {canCreateProject && (
              <Card className="border-2 hover:border-neutral-300 transition-colors">
                <CardContent className="p-0">
                  <Form {...form}>
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        void form.handleSubmit(onSubmit)(e);
                      }}
                      className="p-6 md:p-8"
                    >
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col items-center text-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-neutral-900 text-white flex items-center justify-center">
                            <FolderPlus className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold mb-1">Create a new project</h2>
                            <p className="text-sm text-neutral-500">Start from scratch and set up your own project.</p>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({field}) => (
                              <FormItem>
                                <FormLabel>Project Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="My Awesome Project" {...field} />
                                </FormControl>
                                <FormDescription>You can change this later</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <AnimatePresence>
                          {errorMessage && (
                            <motion.p
                              initial={{opacity: 0, y: -10}}
                              animate={{opacity: 1, y: 0}}
                              exit={{opacity: 0, y: -10}}
                              className="text-sm font-medium text-red-500"
                            >
                              {errorMessage}
                            </motion.p>
                          )}
                        </AnimatePresence>

                        <motion.div layout>
                          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? (
                              <>
                                <IconSpinner size="sm" className="mr-2" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <FolderPlus className="w-4 h-4 mr-2" />
                                Create Project
                              </>
                            )}
                          </Button>
                        </motion.div>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            <Card className="border-2 hover:border-neutral-300 transition-colors">
              <CardContent className="p-6 md:p-8 h-full">
                <div className="flex flex-col gap-6 h-full">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-900 flex items-center justify-center">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold mb-1">Join an existing project</h2>
                      <p className="text-sm text-neutral-500">Get access to a project created by your team</p>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-center gap-4">
                    <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
                      <p className="text-sm text-neutral-600 text-center leading-relaxed">
                        {canCreateProject
                          ? 'Contact your project administrator and ask them to add you as a member. They can invite you from the project settings page or the Authorization page.'
                          : 'Your administrator must authorize your email and share one or more projects with you before you can sign in. After that, those projects will appear here automatically.'}
                      </p>
                    </div>
                    {!canCreateProject && (
                      <Button type="button" variant="outline" className="w-full" onClick={() => void handleLogout()}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Log out
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
